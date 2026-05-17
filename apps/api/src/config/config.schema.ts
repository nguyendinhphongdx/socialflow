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
    jwtAgentSecret: z.string().min(32, 'JWT_AGENT_SECRET phải ≥ 32 chars'),
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
  webhook: z.object({
    facebookVerifyToken: z.string().min(16, 'FACEBOOK_WEBHOOK_VERIFY_TOKEN phải ≥ 16 chars'),
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
  sentry: z.object({
    dsn: z.string().optional().describe('SENTRY_DSN — bỏ trống = disable Sentry (dev/local)'),
    environment: z.string().default('development'),
    release: z.string().optional().describe('GIT_SHA hoặc semver — track per-deploy issue'),
    tracesSampleRate: z.coerce.number().min(0).max(1).default(0.1),
    profilesSampleRate: z.coerce.number().min(0).max(1).default(0.1),
  }),
  stripe: z.object({
    secretKey: z.string().min(1, 'STRIPE_SECRET_KEY required (sk_test_... / sk_live_...)'),
    webhookSecret: z.string().min(1, 'STRIPE_WEBHOOK_SECRET required (whsec_...)'),
    publishableKey: z.string().min(1, 'STRIPE_PUBLISHABLE_KEY required (pk_test_... / pk_live_...)'),
    /// Số VND/USD-cents user trả cho 1 credit. UI hiển thị qua publishableKey + product price.
    pricePerCredit: z.coerce.number().int().positive().default(1000),
    planPriceIds: z.object({
      pro: z.string().default(''),
      business: z.string().default(''),
      enterprise: z.string().default(''),
    }),
    /// Stripe Checkout session — URL FE redirect tới sau khi checkout success/cancel.
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  }),
  notification: z.object({
    /// Resend API key — để rỗng trong dev = log-only (không gửi thật)
    resendApiKey: z.string().default(''),
    /// Email gửi đi (phải verified ở Resend dashboard nếu prod)
    fromEmail: z.string().email().default('no-reply@sociflow.io'),
    fromName: z.string().default('Sociflow'),
    /// App URL gốc dùng để build link trong email body
    appUrl: z.string().url(),
    /// Threshold cảnh báo credit thấp — emit `credit.low` event khi balance < threshold
    creditLowThreshold: z.coerce.number().int().nonnegative().default(20),
    /// VAPID keys cho Web Push. Bỏ trống → push disabled (dev log-only).
    /// Generate: `node -e "console.log(require('web-push').generateVAPIDKeys())"`
    vapidPublicKey: z.string().default(''),
    vapidPrivateKey: z.string().default(''),
    /// `mailto:` contact cho push service (theo VAPID spec)
    vapidSubject: z.string().default('mailto:admin@sociflow.io'),
  }),
})

export type AppConfig = z.infer<typeof ConfigSchema>
