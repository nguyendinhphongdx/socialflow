import { Inject, Injectable } from '@nestjs/common'
import {
  DeleteObjectCommand,
  GetObjectCommand,
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

  buildPublicUrl(key: string): string {
    return `${this.config.publicUrl.replace(/\/$/, '')}/${key}`
  }
}
