import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96 bits — GCM recommended
const TAG_LENGTH = 16

/**
 * Encrypt string với AES-256-GCM.
 *
 * @param plaintext - text cần encrypt
 * @param keyBase64 - 32-byte key, base64-encoded (`config.encryptionKey`)
 * @returns base64 string format: iv(12) || tag(16) || ciphertext
 */
export function encrypt(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64-decoded)')

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/**
 * Decrypt string đã encrypt bằng `encrypt()`.
 */
export function decrypt(payload: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64-decoded)')

  const buf = Buffer.from(payload, 'base64')
  if (buf.length < IV_LENGTH + TAG_LENGTH) throw new Error('Encrypted payload too short')

  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Sha256 hex digest. Dùng cho hash refresh token, API key.
 */
export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Constant-time string equality. Chống timing attack khi so sánh secret.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
