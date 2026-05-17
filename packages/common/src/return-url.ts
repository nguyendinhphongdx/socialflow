import { AppException } from './app-exception'
import { ResponseCode } from './response-code'

/**
 * Validate `returnUrl` để chống open-redirect khi OAuth callback redirect về client.
 *
 * Cho phép:
 * - Relative path bắt đầu bằng `/` (`/dashboard`, `/dashboard?x=1`)
 * - Absolute URL có scheme http/https VÀ origin trùng với `allowedOrigin`
 *   (tức là cùng host:port với `appUrl`)
 *
 * Reject:
 * - Protocol-relative `//evil.com/x`
 * - Khác host
 * - Scheme `javascript:`, `data:`, `file:`, ...
 * - Bất kỳ giá trị không parse được
 *
 * @throws AppException(InvalidReturnUrl) khi không hợp lệ.
 * @returns chuỗi đã chuẩn hoá để redirect (giữ nguyên input nếu hợp lệ).
 */
export function validateReturnUrl(returnUrl: string, allowedOrigin: string): string {
  if (typeof returnUrl !== 'string' || returnUrl.length === 0) {
    throw new AppException(ResponseCode.InvalidReturnUrl, { reason: 'empty' })
  }

  // Protocol-relative URL: `//evil.com/path` — browser resolve thành cross-origin
  if (returnUrl.startsWith('//')) {
    throw new AppException(ResponseCode.InvalidReturnUrl, { reason: 'protocol_relative' })
  }

  // Relative path
  if (returnUrl.startsWith('/')) {
    // Backslash + crlf injection — chuẩn hoá reject
    if (returnUrl.includes('\\') || returnUrl.includes('\n') || returnUrl.includes('\r')) {
      throw new AppException(ResponseCode.InvalidReturnUrl, { reason: 'invalid_chars' })
    }
    return returnUrl
  }

  // Absolute URL — phải match origin với allowedOrigin
  let parsed: URL
  let allowed: URL
  try {
    parsed = new URL(returnUrl)
    allowed = new URL(allowedOrigin)
  }
  catch {
    throw new AppException(ResponseCode.InvalidReturnUrl, { reason: 'malformed' })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppException(ResponseCode.InvalidReturnUrl, { reason: 'invalid_scheme' })
  }
  if (parsed.origin !== allowed.origin) {
    throw new AppException(ResponseCode.InvalidReturnUrl, { reason: 'origin_mismatch' })
  }
  return returnUrl
}
