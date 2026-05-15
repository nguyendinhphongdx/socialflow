import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

export const RegisterDtoSchema = z.object({
  email: z.string().email().max(254).describe('Email đăng ký'),
  password: z.string().min(8).max(128).describe('Mật khẩu (min 8 chars)'),
  name: z.string().min(1).max(80).optional().describe('Tên hiển thị'),
}).strict()

export class RegisterDto extends createZodDto(RegisterDtoSchema, 'RegisterDto') {}

export const LoginDtoSchema = z.object({
  email: z.string().email().describe('Email'),
  password: z.string().min(1).describe('Mật khẩu'),
}).strict()

export class LoginDto extends createZodDto(LoginDtoSchema, 'LoginDto') {}

export const RefreshDtoSchema = z.object({
  refreshToken: z.string().optional().describe('Refresh token (nếu không gửi qua cookie)'),
}).strict()

export class RefreshDto extends createZodDto(RefreshDtoSchema, 'RefreshDto') {}
