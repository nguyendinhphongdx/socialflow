import { Injectable, Logger } from '@nestjs/common'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'
import { AppException, ResponseCode } from '@sociflow/common'
import { StorageService } from '@sociflow/storage'
import {
  AUDIO_MIME,
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME,
  type AllowedMime,
} from './media.dto'

// Số bytes đầu file đủ để detect magic — 4100 bytes là khuyến nghị từ `file-type` README
const MAGIC_BYTE_RANGE = 4100

// Whitelist mime cuối — fallback nếu DTO bypass
const ALL_ALLOWED_MIME = new Set<string>([...IMAGE_MIME, ...VIDEO_MIME, ...AUDIO_MIME])

// Mime equivalence — `file-type` thường trả 'image/jpeg' cho .jpg, nhưng có thể trả khác
// alias trong vài edge case. Map về canonical.
const MIME_ALIAS: Record<string, string> = {
  'video/x-m4v': 'video/mp4',
  'video/mp4v-es': 'video/mp4',
  'audio/x-m4a': 'audio/mp4',
}

function canonicalMime(mime: string): string {
  return MIME_ALIAS[mime] ?? mime
}

interface ValidatedHead {
  declaredMime: AllowedMime
  contentLength: number
}

@Injectable()
export class MediaValidatorService {
  private readonly logger = new Logger(MediaValidatorService.name)

  constructor(private readonly storage: StorageService) {}

  /**
   * Validate object trên storage sau khi client PUT xong:
   * 1. HEAD verify object tồn tại + size khớp limit
   * 2. Đọc magic bytes (first ~4KB), detect actual mime qua file-type
   * 3. So với declaredMime trong DB record
   * 4. Mismatch → delete object → throw MediaInvalidContent
   */
  async verifyContent(storageKey: string, declaredMime: string): Promise<ValidatedHead> {
    const canonical = canonicalMime(declaredMime)
    if (!ALL_ALLOWED_MIME.has(canonical)) {
      throw new AppException(ResponseCode.MediaTypeNotAllowed, { mimeType: declaredMime })
    }

    const head = await this.storage.head(storageKey)
    if (!head) {
      throw new AppException(ResponseCode.MediaUploadFailed, { storageKey, reason: 'object not found' })
    }

    this.assertSizeWithinLimit(canonical, head.contentLength, storageKey)

    const sampleSize = Math.min(MAGIC_BYTE_RANGE, Math.max(head.contentLength - 1, 0))
    const sample = await this.storage.getRange(storageKey, 0, sampleSize)

    const detected = await fileTypeFromBuffer(sample)
    if (!detected) {
      await this.cleanupRejected(storageKey, 'no magic bytes detected')
      throw new AppException(ResponseCode.MediaInvalidContent, { storageKey, reason: 'unknown content' })
    }

    const detectedMime = canonicalMime(detected.mime)
    if (detectedMime !== canonical) {
      await this.cleanupRejected(storageKey, `mime mismatch declared=${canonical} actual=${detectedMime}`)
      throw new AppException(ResponseCode.MediaInvalidContent, {
        storageKey,
        declaredMime: canonical,
        actualMime: detectedMime,
      })
    }

    return { declaredMime: canonical as AllowedMime, contentLength: head.contentLength }
  }

  /**
   * Re-encode image qua sharp để strip EXIF (gồm GPS, camera serial, ...).
   * Output cùng format với input. Skip GIF (animated — sharp single frame).
   */
  async stripExifAndReupload(storageKey: string, mime: AllowedMime): Promise<void> {
    if (!IMAGE_MIME.includes(mime as typeof IMAGE_MIME[number])) return
    if (mime === 'image/gif') return     // animated GIF sharp xử lý kém — bỏ qua strip

    // Đọc toàn bộ file qua getRange (image ≤ 20MB nên OK)
    const head = await this.storage.head(storageKey)
    if (!head) {
      throw new AppException(ResponseCode.MediaUploadFailed, { storageKey, reason: 'object disappeared' })
    }
    const buffer = await this.storage.getRange(storageKey, 0, head.contentLength - 1)

    const pipeline = sharp(buffer, { failOn: 'error' }).rotate()  // honor EXIF orientation rồi strip
    const cleaned = await this.encodeForMime(pipeline, mime)

    await this.storage.putBuffer(storageKey, cleaned, mime)
    this.logger.debug(`Stripped EXIF cho ${storageKey} (${buffer.byteLength} → ${cleaned.byteLength} bytes)`)
  }

  private async encodeForMime(pipeline: sharp.Sharp, mime: AllowedMime): Promise<Buffer> {
    if (mime === 'image/jpeg') return pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    if (mime === 'image/png') return pipeline.png({ compressionLevel: 9 }).toBuffer()
    if (mime === 'image/webp') return pipeline.webp({ quality: 90 }).toBuffer()
    // Fallback — không nên xảy ra vì caller đã filter
    return pipeline.toBuffer()
  }

  private assertSizeWithinLimit(mime: string, contentLength: number, storageKey: string) {
    const isImage = (IMAGE_MIME as readonly string[]).includes(mime)
    const isVideo = (VIDEO_MIME as readonly string[]).includes(mime)
    if (isImage && contentLength > MAX_IMAGE_BYTES) {
      throw new AppException(ResponseCode.MediaSizeExceeded, { storageKey, limit: MAX_IMAGE_BYTES, actual: contentLength })
    }
    if (isVideo && contentLength > MAX_VIDEO_BYTES) {
      throw new AppException(ResponseCode.MediaSizeExceeded, { storageKey, limit: MAX_VIDEO_BYTES, actual: contentLength })
    }
  }

  private async cleanupRejected(storageKey: string, reason: string): Promise<void> {
    this.logger.warn(`Rejecting media ${storageKey}: ${reason}`)
    await this.storage.delete(storageKey).catch((err) => {
      this.logger.error(`Cleanup delete failed cho ${storageKey}: ${(err as Error).message}`)
    })
  }
}
