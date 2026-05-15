import { Injectable } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { AppException, ResponseCode } from '@sociflow/common'

interface ContextData {
  userId?: string
  sessionId?: string
  traceId?: string
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

  /**
   * Throw `AuthRequired` nếu chưa có userId trong context.
   * Dùng trong service khi endpoint require auth.
   */
  requireUserId(): string {
    const id = this.userId
    if (!id) throw new AppException(ResponseCode.AuthRequired)
    return id
  }

  set(data: ContextData): void {
    if (data.userId !== undefined) this.cls.set('userId', data.userId)
    if (data.sessionId !== undefined) this.cls.set('sessionId', data.sessionId)
    if (data.traceId !== undefined) this.cls.set('traceId', data.traceId)
  }
}
