import { z } from 'zod'

/**
 * Root config schema. Tất cả env vars validate qua zod, fail-fast nếu thiếu.
 */
export const ConfigSchema = z.object({
  app: z.object({
    env: z.enum(['development', 'test', 'staging', 'production']),
    port: z.coerce.number().int().positive().default(3000),
    corsOrigins: z.array(z.string()).min(1),
    cookieDomain: z.string().optional(),
    cookieSecure: z.coerce.boolean().default(false),
  }),
  database: z.object({
    url: z.string().url(),
  }),
  redis: z.object({
    url: z.string().url(),
  }),
  auth: z.object({
    jwtAccessSecret: z.string().min(32, 'JWT_ACCESS_SECRET phải ≥ 32 chars'),
    jwtRefreshSecret: z.string().min(32, 'JWT_REFRESH_SECRET phải ≥ 32 chars'),
    jwtAccessExpiration: z.string().default('15m'),
    jwtRefreshExpiration: z.string().default('7d'),
    accessCookieName: z.string().default('sf_access'),
    refreshCookieName: z.string().default('sf_refresh'),
  }),
  encryption: z.object({
    key: z.string().min(40, 'ENCRYPTION_KEY phải là base64 của 32 bytes'),
  }),
  internal: z.object({
    token: z.string().min(16),
  }),
  mail: z.object({
    host: z.string(),
    port: z.coerce.number().int().positive(),
    user: z.string().optional(),
    password: z.string().optional(),
    from: z.string(),
  }),
  storage: z.object({
    type: z.enum(['s3', 'local']).default('s3'),
    endpoint: z.string().url(),
    region: z.string(),
    bucket: z.string(),
    accessKey: z.string(),
    secretKey: z.string(),
    publicUrl: z.string().url(),
  }),
  oauth: z.object({
    google: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      redirectUri: z.string().url(),
    }),
    youtube: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      redirectUri: z.string().url(),
    }),
    facebook: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      redirectUri: z.string().url(),
    }),
    instagram: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      redirectUri: z.string().url(),
    }),
    tiktok: z.object({
      clientKey: z.string(),
      clientSecret: z.string(),
      redirectUri: z.string().url(),
    }),
  }),
  web: z.object({
    appUrl: z.string().url(),
  }),
  agent: z.object({
    wsUrl: z.string().url().describe('Public WS URL extension dùng để connect sau khi pair'),
    pairCodeTtlSec: z.coerce.number().int().positive().default(300),
    tokenExpiration: z.string().default('365d'),
  }),
})

export type AppConfig = z.infer<typeof ConfigSchema>
