import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { MediaAsset } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { StorageService } from '@sociflow/storage'
import { MediaRepository } from './media.repository'
import { MediaValidatorService } from './media-validator.service'
import { IMAGE_MIME, type AllowedMime, type CreateUploadUrlDto } from './media.dto'

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name)

  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: StorageService,
    private readonly validator: MediaValidatorService,
    private readonly ctx: RequestContextService,
  ) {}

  async createUploadUrl(dto: CreateUploadUrlDto) {
    const userId = this.ctx.requireUserId()
    const workspaceId = this.ctx.requireWorkspaceId()
    const ext = (dto.filename.split('.').pop() ?? 'bin').toLowerCase()
    const random = randomBytes(8).toString('hex')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/')   // 2026/05/15
    const storageKey = `uploads/${workspaceId}/${date}/${random}.${ext}`

    const presign = await this.storage.createUploadUrl({
      key: storageKey,
      contentType: dto.mimeType,
      contentLengthMax: dto.sizeBytes,
    })

    const media = await this.repo.create({
      user: { connect: { id: userId } },
      workspace: { connect: { id: workspaceId } },
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

  /**
   * Confirm upload từ client → validate content thực sự khớp declared mime.
   *
   * Flow:
   * 1. Load record + ownership check.
   * 2. Validator: HEAD + magic-byte sniff → mismatch → cleanup + AppException.
   * 3. Image: re-encode strip EXIF (đè key cũ).
   * 4. Mark status=UPLOADED.
   *
   * Nếu fail validation → record bị mark FAILED và object bị xoá khỏi storage.
   */
  async confirmUpload(mediaId: string): Promise<MediaAsset> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const media = await this.repo.getByIdAndWorkspaceId(mediaId, workspaceId)
    if (!media) throw new AppException(ResponseCode.MediaNotFound, { mediaId })
    if (media.status === 'UPLOADED') return media

    // Mark FAILED nếu validator throw — sau đó rethrow để client biết lỗi cụ thể.
    // Validator đã tự xoá object trên storage khi mismatch, ở đây chỉ cập nhật DB.
    const validated = await this.validator.verifyContent(media.storageKey, media.mimeType)
      .catch(async (err) => {
        await this.repo.updateById(media.id, { status: 'FAILED' })
        throw err
      })

    if ((IMAGE_MIME as readonly string[]).includes(validated.declaredMime)) {
      await this.validator.stripExifAndReupload(media.storageKey, validated.declaredMime as AllowedMime)
    }

    return this.repo.updateById(media.id, {
      status: 'UPLOADED',
      sizeBytes: validated.contentLength,
    })
  }

  /** @deprecated F-716 — dùng `listByCurrentWorkspace`. */
  async listByCurrentUser(pagination: PaginationDto, filter?: { type?: any, status?: any }) {
    return this.listByCurrentWorkspace(pagination, filter)
  }

  async listByCurrentWorkspace(pagination: PaginationDto, filter?: { type?: any, status?: any }) {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceWithPagination(workspaceId, pagination, filter)
  }

  /** @deprecated F-716 — dùng `getByCurrentWorkspaceAndId`. */
  async getByCurrentUserAndId(id: string): Promise<MediaAsset> {
    return this.getByCurrentWorkspaceAndId(id)
  }

  async getByCurrentWorkspaceAndId(id: string): Promise<MediaAsset> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const media = await this.repo.getByIdAndWorkspaceId(id, workspaceId)
    if (!media) throw new AppException(ResponseCode.MediaNotFound, { mediaId: id })
    return media
  }

  async listForPublish(mediaIds: string[]): Promise<MediaAsset[]> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.listForPublishByWorkspaceId(workspaceId, mediaIds)
  }

  /**
   * Variant cho BullMQ worker (no CLS context) — caller pass userId từ PublishRecord.
   * @deprecated F-716 — dùng `listForPublishByWorkspaceId`.
   */
  async listForPublishByUserId(userId: string, mediaIds: string[]): Promise<MediaAsset[]> {
    if (mediaIds.length === 0) return []
    const list = await this.repo.listByIdsAndUserId(mediaIds, userId)
    return this.validatePublishList(list, mediaIds)
  }

  /**
   * Variant cho BullMQ worker — caller pass workspaceId từ PublishRecord.
   */
  async listForPublishByWorkspaceId(workspaceId: string, mediaIds: string[]): Promise<MediaAsset[]> {
    if (mediaIds.length === 0) return []
    const list = await this.repo.listByIdsAndWorkspaceId(mediaIds, workspaceId)
    return this.validatePublishList(list, mediaIds)
  }

  private validatePublishList(list: MediaAsset[], mediaIds: string[]): MediaAsset[] {
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
    const media = await this.getByCurrentWorkspaceAndId(id)
    await this.storage.delete(media.storageKey).catch((err) => {
      this.logger.warn(`Storage delete failed cho ${media.storageKey}: ${err.message}`)
    })
    await this.repo.softDeleteById(media.id)
  }
}
