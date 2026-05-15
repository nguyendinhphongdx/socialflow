export interface StorageConfig {
  endpoint: string                 // http://localhost:9000 (MinIO) hoặc R2 endpoint
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  publicUrl: string                // public URL prefix (CDN domain hoặc MinIO public)
  forcePathStyle?: boolean         // true cho MinIO, false cho R2
}

export interface PresignedUploadUrl {
  url: string                      // PUT URL — client PUT trực tiếp lên đây
  key: string                      // storage key cuối cùng
  publicUrl: string                // URL public sau khi upload xong
  expiresIn: number                // seconds
  headers: Record<string, string>  // headers client BẮT BUỘC gửi khi PUT (Content-Type, ...)
}

export interface PresignedDownloadUrl {
  url: string
  expiresIn: number
}