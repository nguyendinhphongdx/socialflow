import { z } from 'zod'

export const PaginationDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe('Trang hiện tại (1-indexed)'),
  pageSize: z.coerce.number().int().positive().max(100).default(20).describe('Số item / trang (max 100)'),
})

export type PaginationDto = z.infer<typeof PaginationDtoSchema>

export interface Paginated<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function paginate<T>(list: T[], total: number, pagination: PaginationDto): Paginated<T> {
  return {
    list,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize),
  }
}
