import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import type {
  CancelTaskCommand,
  PublishCommand,
} from '@sociflow/ws-protocol'
import { AgentGateway } from './agent.gateway'
import { AgentRegistryService } from './agent-registry.service'
import { AutomationTaskService } from './automation-task.service'

/**
 * Service "dispatch" message từ HTTP/Consumer layer xuống socket cụ thể.
 *
 * Cách dùng: PublishConsumer (Phase J7) inject service này, gọi
 * `dispatchPublish(taskId, agentId, command)` để gửi xuống extension qua WS.
 */
@Injectable()
export class AgentDispatcherService {
  private readonly logger = new Logger(AgentDispatcherService.name)

  constructor(
    private readonly gateway: AgentGateway,
    private readonly registry: AgentRegistryService,
    private readonly tasks: AutomationTaskService,
  ) {}

  /**
   * Gửi publish command xuống agent đang online.
   * - Nếu agent offline → throw AppException(AgentOffline)
   * - Sau khi emit thành công → mark task DISPATCHED
   */
  async dispatchPublish(taskId: string, agentId: string, command: PublishCommand): Promise<void> {
    const socketId = await this.registry.getOnlineSocketId(agentId)
    if (!socketId) {
      throw new AppException(ResponseCode.AgentOffline, { agentId })
    }
    this.gateway.server.to(socketId).emit('s2a:publish', command)
    await this.tasks.markDispatched(taskId)
    this.logger.log(`dispatched publish task ${taskId} → agent ${agentId} (socket ${socketId})`)
  }

  async dispatchCancel(taskId: string, agentId: string, command: CancelTaskCommand): Promise<void> {
    const socketId = await this.registry.getOnlineSocketId(agentId)
    if (!socketId) {
      throw new AppException(ResponseCode.AgentOffline, { agentId })
    }
    this.gateway.server.to(socketId).emit('s2a:cancel', command)
    this.logger.log(`dispatched cancel task ${taskId} → agent ${agentId} (socket ${socketId})`)
  }

  /**
   * Probe `s2a:ping` đến agent (dùng cho health-check trên dashboard).
   * Không throw nếu offline — chỉ return false.
   */
  async pingAgent(agentId: string): Promise<boolean> {
    const socketId = await this.registry.getOnlineSocketId(agentId)
    if (!socketId) return false
    this.gateway.server.to(socketId).emit('s2a:ping', { type: 's2a:ping', ts: Date.now() })
    return true
  }
}
