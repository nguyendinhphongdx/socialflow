import { Injectable, Logger } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import {
  AgentToServerMessageSchema,
  type AckMessage,
  type AgentHeartbeat,
  type PongMessage,
  type TaskCompleteMessage,
  type TaskFailedMessage,
  type TaskStatusMessage,
} from '@sociflow/ws-protocol'
import { PrismaService } from '@sociflow/prisma'
import { AgentService } from '../agent.service'
import { AgentRegistryService } from './agent-registry.service'
import { AutomationTaskService } from './automation-task.service'

/**
 * WS Gateway cho extension agent.
 *
 * - Namespace: `/agents` → URL connect: `ws(s)://<host>/agents`
 * - Auth: extension truyền `auth.token` qua Socket.IO handshake (best practice
 *   tránh để token trong query string log lại).
 * - Mỗi connect:
 *   1. Verify token via `AgentService.getByAgentToken` (sha256 + revoke check
 *      đã constant-time compare ngầm qua Prisma `findUnique` trên indexed hash)
 *   2. Lưu agentId/userId vào `socket.data` để các handler dùng
 *   3. Mark online (Redis + DB)
 *   4. Emit `s2a:ping` để client verify connection live
 */
@Injectable()
@WebSocketGateway({
  namespace: '/agents',
  path: '/socket.io',                        // explicit default
  // CORS được quản lý bởi `SociflowSocketIoAdapter` (đọc whitelist từ AppConfig).
  // Không set inline để tránh nhầm lẫn về source-of-truth.
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly agentService: AgentService,
    private readonly registry: AgentRegistryService,
    private readonly tasks: AutomationTaskService,
    private readonly prisma: PrismaService,
  ) {}

  // ================================================
  // Connection lifecycle
  // ================================================
  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client)
    if (!token) {
      this.logger.warn(`reject connection ${client.id} — missing token`)
      client.disconnect(true)
      return
    }

    const agent = await this.agentService.getByAgentToken(token)
    if (!agent) {
      this.logger.warn(`reject connection ${client.id} — invalid token`)
      client.disconnect(true)
      return
    }

    client.data.agentId = agent.id
    client.data.userId = agent.userId

    const now = new Date()
    await this.registry.markOnline(agent.id, agent.userId, client.id, agent.capabilities ?? [])
    await this.prisma.automationAgent.update({
      where: { id: agent.id },
      data: { online: true, lastSeenAt: now, lastConnectedAt: now },
    })

    this.logger.log(`agent ${agent.id} connected (socket ${client.id}, user ${agent.userId})`)

    client.emit('s2a:ping', { type: 's2a:ping', ts: Date.now() })
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const agentId = client.data?.agentId as string | undefined
    if (!agentId) return

    // Chỉ unset registry nếu socket hiện tại vẫn là socket được register cho
    // agent này (tránh case agent connect tab mới → tab cũ disconnect → wipe mất)
    const current = await this.registry.getOnlineSocketId(agentId)
    if (current === client.id) {
      await this.registry.markOffline(agentId)
      await this.prisma.automationAgent.update({
        where: { id: agentId },
        data: { online: false, lastSeenAt: new Date() },
      })
    }
    this.logger.log(`agent ${agentId} disconnected (socket ${client.id})`)
  }

  // ================================================
  // Inbound (Agent → Server) handlers
  // ================================================
  @SubscribeMessage('a2s:ack')
  async onAck(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const msg = this.parseInbound(client, body)
    if (msg?.type !== 'a2s:ack') return
    await this.handleAck(client, msg)
  }

  @SubscribeMessage('a2s:status')
  async onStatus(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const msg = this.parseInbound(client, body)
    if (msg?.type !== 'a2s:status') return
    await this.handleStatus(client, msg)
  }

  @SubscribeMessage('a2s:complete')
  async onComplete(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const msg = this.parseInbound(client, body)
    if (msg?.type !== 'a2s:complete') return
    await this.handleComplete(client, msg)
  }

  @SubscribeMessage('a2s:failed')
  async onFailed(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const msg = this.parseInbound(client, body)
    if (msg?.type !== 'a2s:failed') return
    await this.handleFailed(client, msg)
  }

  @SubscribeMessage('a2s:pong')
  async onPong(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const msg = this.parseInbound(client, body)
    if (msg?.type !== 'a2s:pong') return
    await this.handlePong(client, msg)
  }

  @SubscribeMessage('a2s:heartbeat')
  async onHeartbeat(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const msg = this.parseInbound(client, body)
    if (msg?.type !== 'a2s:heartbeat') return
    await this.handleHeartbeat(client, msg)
  }

  // ================================================
  // Helpers (private — keep handlers small)
  // ================================================
  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined
    if (auth && typeof auth.token === 'string' && auth.token.length > 0) return auth.token
    // fallback: Authorization header `Bearer <token>` (legacy)
    const header = client.handshake.headers.authorization
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim() || null
    }
    return null
  }

  private parseInbound(client: Socket, body: unknown) {
    const result = AgentToServerMessageSchema.safeParse(body)
    if (!result.success) {
      this.logger.warn(
        `invalid inbound message from ${client.data?.agentId ?? client.id}: ${result.error.message}`,
      )
      return null
    }
    return result.data
  }

  private requireAgentId(client: Socket): string | null {
    const id = client.data?.agentId as string | undefined
    if (!id) {
      this.logger.warn(`socket ${client.id} sent message without agent context — force disconnect`)
      client.disconnect(true)
      return null
    }
    return id
  }

  private async handleAck(client: Socket, msg: AckMessage): Promise<void> {
    const agentId = this.requireAgentId(client)
    if (!agentId) return
    const task = await this.tasks.getById(msg.taskId).catch(() => null)
    if (!task || task.agentId !== agentId) {
      this.logger.warn(`agent ${agentId} acked unknown/foreign task ${msg.taskId}`)
      return
    }
    await this.tasks.markAcknowledged(msg.taskId)
    await this.registry.touchLastSeen(agentId)
  }

  private async handleStatus(client: Socket, msg: TaskStatusMessage): Promise<void> {
    const agentId = this.requireAgentId(client)
    if (!agentId) return
    const task = await this.tasks.getById(msg.taskId).catch(() => null)
    if (!task || task.agentId !== agentId) return
    await this.tasks.updateStatus(msg.taskId, msg.stage, msg.progress)
    await this.registry.touchLastSeen(agentId)
  }

  private async handleComplete(client: Socket, msg: TaskCompleteMessage): Promise<void> {
    const agentId = this.requireAgentId(client)
    if (!agentId) return
    const task = await this.tasks.getById(msg.taskId).catch(() => null)
    if (!task || task.agentId !== agentId) return

    const result = { platformPostId: msg.platformPostId, workLink: msg.workLink }
    await this.tasks.markSuccess(msg.taskId, result)

    if (task.publishRecordId) {
      await this.prisma.publishRecord.update({
        where: { id: task.publishRecordId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          platformPostId: msg.platformPostId,
          workLink: msg.workLink,
          errorMessage: null,
        },
      })
    }
    await this.registry.touchLastSeen(agentId)
  }

  private async handleFailed(client: Socket, msg: TaskFailedMessage): Promise<void> {
    const agentId = this.requireAgentId(client)
    if (!agentId) return
    const task = await this.tasks.getById(msg.taskId).catch(() => null)
    if (!task || task.agentId !== agentId) return

    await this.tasks.markFailed(msg.taskId, msg.reason, msg.screenshotUrl ?? null)

    if (task.publishRecordId) {
      const nextStatus = msg.recoverable ? 'FAILED' : 'REJECTED'
      await this.prisma.publishRecord.update({
        where: { id: task.publishRecordId },
        data: {
          status: nextStatus,
          errorMessage: msg.reason,
        },
      })
    }
    await this.registry.touchLastSeen(agentId)
  }

  private async handlePong(client: Socket, msg: PongMessage): Promise<void> {
    const agentId = this.requireAgentId(client)
    if (!agentId) return
    await this.registry.touchLastSeen(agentId)
    this.logger.debug?.(`pong from ${agentId} caps=${msg.capabilities.join(',')} ts=${msg.ts}`)
  }

  private async handleHeartbeat(client: Socket, msg: AgentHeartbeat): Promise<void> {
    const agentId = this.requireAgentId(client)
    if (!agentId) return
    await this.registry.extendTtl(agentId)
    await this.registry.touchLastSeen(agentId)
    await this.prisma.automationAgent.update({
      where: { id: agentId },
      data: { lastSeenAt: new Date() },
    })
    this.logger.debug?.(`heartbeat from ${agentId} tabs=${msg.activeTabsCount} mem=${msg.memoryMb ?? 0}`)
  }
}
