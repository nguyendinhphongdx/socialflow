import { Injectable, Logger } from '@nestjs/common'
import type { Draft, PublishRecord } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { PublishService } from '../publish/publish.service'
import { DraftRepository } from './draft.repository'
import type { CreateDraftDto, PublishDraftDto, UpdateDraftDto } from './draft.dto'

@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name)

  constructor(
    private readonly repo: DraftRepository,
    private readonly ctx: RequestContextService,
    private readonly publishService: PublishService,
  ) {}

  async create(dto: CreateDraftDto): Promise<Draft> {
    const userId = this.ctx.requireUserId()
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.create({
      user: { connect: { id: userId } },
      workspace: { connect: { id: workspaceId } },
      title: dto.title,
      body: dto.body,
      mediaIds: dto.mediaIds,
      platformOptions: dto.platformOptions as object | undefined,
      tags: dto.tags,
    })
  }

  /** @deprecated F-716 — dùng `listByCurrentWorkspace`. */
  async listByCurrentUser(pagination: PaginationDto, filter?: { tag?: string }) {
    return this.listByCurrentWorkspace(pagination, filter)
  }

  async listByCurrentWorkspace(pagination: PaginationDto, filter?: { tag?: string }) {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceWithPagination(workspaceId, pagination, filter)
  }

  /** @deprecated F-716 — dùng `getByCurrentWorkspaceAndId`. */
  async getByCurrentUserAndId(id: string): Promise<Draft> {
    return this.getByCurrentWorkspaceAndId(id)
  }

  async getByCurrentWorkspaceAndId(id: string): Promise<Draft> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const draft = await this.repo.getByIdAndWorkspaceId(id, workspaceId)
    if (!draft) throw new AppException(ResponseCode.DraftNotFound, { draftId: id })
    return draft
  }

  async update(id: string, dto: UpdateDraftDto): Promise<Draft> {
    const existing = await this.getByCurrentWorkspaceAndId(id)
    return this.repo.updateById(existing.id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.body !== undefined && { body: dto.body }),
      ...(dto.mediaIds !== undefined && { mediaIds: dto.mediaIds }),
      ...(dto.platformOptions !== undefined && {
        platformOptions: dto.platformOptions as object,
      }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
    })
  }

  async softDelete(id: string): Promise<void> {
    const draft = await this.getByCurrentWorkspaceAndId(id)
    await this.repo.softDeleteById(draft.id)
  }

  async publishDraft(id: string, dto: PublishDraftDto): Promise<PublishRecord[]> {
    const draft = await this.getByCurrentWorkspaceAndId(id)
    const records = await this.publishService.createBundle({
      accountIds: dto.accountIds,
      title: draft.title ?? undefined,
      body: draft.body ?? undefined,
      mediaIds: draft.mediaIds,
      platformOptions: (draft.platformOptions ?? undefined) as Record<string, unknown> | undefined,
      publishTime: dto.publishTime,
      idempotencyKey: dto.idempotencyKey,
    })
    await this.repo.softDeleteById(draft.id)
    this.logger.log(`Draft ${draft.id} converted thành ${records.length} publish record(s)`)
    return records
  }
}
