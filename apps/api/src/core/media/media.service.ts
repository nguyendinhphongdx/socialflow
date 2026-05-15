import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { MediaAsset } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { StorageService } from '@sociflow/storage'
import { MediaRepository } from './media.repository'
import type { CreateUploadUrlDto } from './media.dto'

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name)

  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: StorageService,
    private readonly ctx: RequestContextService,
  ) {}

  async createUploadUrl(dto: CreateUploadUrlDto) {
    const userId = this.ctx.requireUserId()
    const ext = (dto.filename.split('.').pop() ?? 'bin').toLowerCase()
    const random = randomBytes(8).toString('hex')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/')   // 2026/05/15
    const storageKey = `uploads/${userId}/${date}/${random}.${ext}`

    const presign = await this.storage.createUploadUrl({
      key: storageKey,
      contentType: dto.mimeType,
      contentLengthMax: dto.sizeBytes,
    })

    const media = await this.repo.create({
      user: { connect: { id: userId } },
      type: dto.type,
      filename: dto.filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      durationMs: dto.durationMs,
      width: dto.width,
      height: dto.height,
      storageKey,
      publicUrl: presign.publicUrl,
      source: 'UPLOAD',
      status: 'PENDING',
    })

    return {
      mediaId: media.id,
      uploadUrl: presign.url,
      storageKey,
      publicUrl: presign.publicUrl,
      expiresIn: presign.expiresIn,
      headers: presign.headers,
    }
  }

  async confirmUpload(mediaId: string): Promise<MediaAsset> {
    const userId = this.ctx.requireUserId()
    const media = await this.repo.getByIdAndUserId(mediaId, userId)
    if (!media) throw new AppException(ResponseCode.MediaNotFound, { mediaId })
    if (media.status === 'UPLOADED') return media

    return this.repo.updateById(media.id, { status: 'UPLOADED' })
  }

  async listByCurrentUser(pagination: PaginationDto, filter?: { type?: any, status?: any }) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string): Promise<MediaAsset> {
    const userId = this.ctx.requireUserId()
    const media = await this.repo.getByIdAndUserId(id, userId)
    if (!media) throw new AppException(ResponseCode.MediaNotFound, { mediaId: id })
    return media
  }

  async listForPublish(mediaIds: string[]): Promise<MediaAsset[]> {
    const userId = this.ctx.requireUserId()
    return this.listForPublishByUserId(userId, mediaIds)
  }

  /**
   * Variant cho BullMQ worker (no CLS context) — caller pass userId từ PublishRecord.
   */
  async listForPublishByUserId(userId: string, mediaIds: string[]): Promise<MediaAsset[]> {
    if (mediaIds.length === 0) return []
    const list = await this.repo.listByIdsAndUserId(mediaIds, userId)
    if (list.length !== mediaIds.length) {
      throw new AppException(ResponseCode.MediaNotFound, {
        requested: mediaIds,
        found: list.map(m => m.id),
      })
    }
    const notUploaded = list.filter(m => m.status !== 'UPLOADED')
    if (notUploaded.length > 0) {
      throw new AppException(ResponseCode.MediaUploadFailed, {
        notUploaded: notUploaded.map(m => m.id),
      })
    }
    return list
  }

  async softDelete(id: string): Promise<void> {
    const media = await this.getByCurrentUserAndId(id)
    await this.storage.delete(media.storageKey).catch((err) => {
      this.logger.warn(`Storage delete failed cho ${media.storageKey}: ${err.message}`)
    })
    await this.repo.softDeleteById(media.id)
  }
}
