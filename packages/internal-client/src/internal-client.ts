import axios, { type AxiosInstance } from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'

export interface InternalClientOptions {
  baseUrl: string                  // http://localhost:3001/api/v1
  internalToken: string            // shared secret từ INTERNAL_TOKEN env
  timeoutMs?: number               // default 30s
  serviceName?: string             // 'api' — đưa vào header để bên kia log
}

/**
 * Typed HTTP client cho internal-service calls (`api → ai`, `ai → api`).
 *
 * - Auth: header `X-Internal-Token: <INTERNAL_TOKEN>` (shared secret)
 * - Trace propagation: forward `X-Trace-Id` từ caller context (set bởi caller wrapper)
 * - Error mapping: response body với `code != 0` → throw AppException
 */
export function createInternalClient(opts: InternalClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: opts.baseUrl,
    timeout: opts.timeoutMs ?? 30_000,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': opts.internalToken,
      'X-Internal-Service': opts.serviceName ?? 'unknown',
    },
  })

  client.interceptors.response.use(
    (res) => {
      const body = res.data as { code?: number, message?: string, data?: unknown } | undefined
      if (body && typeof body.code === 'number' && body.code !== 0) {
        throw new AppException((body.code as ResponseCode) ?? ResponseCode.InternalError, body.data)
      }
      return res
    },
    (err) => {
      if (err.response?.status === 401) {
        throw new AppException(ResponseCode.AuthRequired, { reason: 'internal_token_invalid' })
      }
      throw err
    },
  )

  return client
}
