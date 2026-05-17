import { Injectable } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { AppException, ResponseCode } from '@sociflow/common'

interface ContextData {
  userId?: string
  sessionId?: string
  traceId?: string
  workspaceId?: string
  workspaceRole?: string
}

/**
 * Request-scoped context backed by AsyncLocalStorage (nestjs-cls).
 *
 * Set qua `JwtAuthGuard.handleRequest` (auto) hoặc explicit `set()`.
 * Đọc qua getter — service không cần truyền `userId` qua param khắp nơi.
 */
@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  get userId(): string | undefined { return this.cls.get('userId') }
  get sessionId(): string | undefined { return this.cls.get('sessionId') }
  get traceId(): string | undefined { return this.cls.get('traceId') }
  get ip(): string | undefined { return this.cls.get('ip') }
  get userAgent(): string | undefined { return this.cls.get('userAgent') }
  get workspaceId(): string | undefined { return this.cls.get('workspaceId') }
  get workspaceRole(): string | undefined { return this.cls.get('workspaceRole') }

  /**
   * Throw `AuthRequired` nếu chưa có userId trong context.
   * Dùng trong service khi endpoint require auth.
   */
  requireUserId(): string {
    const id = this.userId
    if (!id) throw new AppException(ResponseCode.AuthRequired)
    return id
  }

  /**
   * Throw `WorkspaceAccessDenied` nếu chưa có workspaceId trong context.
   * Dùng trong service khi endpoint scope theo workspace (publish, draft, media,
   * social account). WorkspaceContextGuard set value sau khi verify membership.
   */
  requireWorkspaceId(): string {
    const id = this.workspaceId
    if (!id) throw new AppException(ResponseCode.WorkspaceAccessDenied)
    return id
  }

  /**
   * Set workspaceId — dùng cho consumer/worker bootstrap khi không có HTTP request,
   * vd publish.consumer khôi phục context từ job data.
   */
  setWorkspaceId(workspaceId: string): void {
    this.cls.set('workspaceId', workspaceId)
  }

  set(data: ContextData): void {
    if (data.userId !== undefined) this.cls.set('userId', data.userId)
    if (data.sessionId !== undefined) this.cls.set('sessionId', data.sessionId)
    if (data.traceId !== undefined) this.cls.set('traceId', data.traceId)
    if (data.workspaceId !== undefined) this.cls.set('workspaceId', data.workspaceId)
    if (data.workspaceRole !== undefined) this.cls.set('workspaceRole', data.workspaceRole)
  }
}
