import { Inject, Injectable } from '@nestjs/common'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { PresignedDownloadUrl, PresignedUploadUrl, StorageConfig } from './types'

export const STORAGE_CONFIG = 'STORAGE_CONFIG'

const DEFAULT_UPLOAD_TTL = 15 * 60       // 15 phút
const DEFAULT_DOWNLOAD_TTL = 15 * 60

interface CreateUploadUrlOptions {
  key: string
  contentType: string
  contentLengthMax?: number              // bytes — chống upload file too large
  expiresIn?: number                     // seconds
}

@Injectable()
export class StorageService {
  private readonly s3: S3Client

  constructor(@Inject(STORAGE_CONFIG) private readonly config: StorageConfig) {
    this.s3 = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    })
  }

  /**
   * Pre-signed PUT URL — client upload trực tiếp lên S3/R2, không qua server.
   */
  async createUploadUrl(opts: CreateUploadUrlOptions): Promise<PresignedUploadUrl> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      ...(opts.contentLengthMax && { ContentLength: opts.contentLengthMax }),
    })
    const expiresIn = opts.expiresIn ?? DEFAULT_UPLOAD_TTL
    const url = await getSignedUrl(this.s3, command, { expiresIn })

    return {
      url,
      key: opts.key,
      publicUrl: this.buildPublicUrl(opts.key),
      expiresIn,
      headers: { 'Content-Type': opts.contentType },
    }
  }

  async createDownloadUrl(key: string, expiresIn = DEFAULT_DOWNLOAD_TTL): Promise<PresignedDownloadUrl> {
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
    const url = await getSignedUrl(this.s3, command, { expiresIn })
    return { url, expiresIn }
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }))
  }

  /**
   * HEAD object — verify tồn tại + lấy metadata (size, content-type).
   * Trả null nếu object không tồn tại (404).
   */
  async head(key: string): Promise<{ contentLength: number, contentType?: string } | null> {
    try {
      const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }))
      return {
        contentLength: Number(res.ContentLength ?? 0),
        contentType: res.ContentType,
      }
    }
    catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
      if (status === 404) return null
      throw err
    }
  }

  /**
   * Đọc range bytes [start, end] của object — dùng cho magic-byte detection.
   * Trả Buffer chứa partial content.
   */
  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Range: `bytes=${start}-${end}`,
    }))
    const body = res.Body
    if (!body) throw new Error(`Empty body khi đọc range ${key}`)
    return streamToBuffer(body as unknown as AsyncIterable<Uint8Array>)
  }

  /**
   * Upload Buffer trực tiếp lên storage — dùng cho re-encode (EXIF strip).
   */
  async putBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    }))
  }

  buildPublicUrl(key: string): string {
    return `${this.config.publicUrl.replace(/\/$/, '')}/${key}`
  }
}

async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
