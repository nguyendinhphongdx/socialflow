/**
 * Response envelope shape match `@sociflow/common` TransformInterceptor.
 */
export interface ApiResponse<T> {
  data: T
  code: number
  message: string
  timestamp: number
}

export interface ApiError {
  code: number
  message: string
  data?: unknown
  timestamp: number
}

export function isApiSuccess<T>(res: ApiResponse<T>): boolean {
  return res.code === 0
}

export type ID = string
export type ISODate = string
export type Nullable<T> = T | null
export type Maybe<T> = T | null | undefined
