import { ConfigSchema, type AppConfig } from './config.schema'

/**
 * Load + validate env → AppConfig. Fail-fast khi thiếu key required.
 *
 * Gọi 1 lần trong main.ts (trước NestFactory.create) HOẶC qua ConfigModule.forRoot factory.
 */
export function loadConfig(): AppConfig {
  const raw = {
    app: {
      env: process.env.NODE_ENV ?? 'development',
      port: process.env.API_PORT ?? 3000,
      corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3010').split(',').map(s => s.trim()),
      cookieDomain: process.env.COOKIE_DOMAIN || undefined,
      cookieSecure: process.env.COOKIE_SECURE === 'true',
    },
    database: { url: process.env.DATABASE_URL },
    redis: { url: process.env.REDIS_URL },
    auth: {
      jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
      jwtAgentSecret: process.env.JWT_AGENT_SECRET,
      jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION,
      jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION,
      accessCookieName: process.env.ACCESS_COOKIE_NAME,
      refreshCookieName: process.env.REFRESH_COOKIE_NAME,
    },
    webhook: {
      facebookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
    },
    encryption: { key: process.env.ENCRYPTION_KEY },
    internal: { token: process.env.INTERNAL_TOKEN },
    mail: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
      from: process.env.SMTP_FROM,
    },
    storage: {
      type: process.env.STORAGE_TYPE,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      bucket: process.env.S3_BUCKET,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      publicUrl: process.env.S3_PUBLIC_URL,
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? 'dev-google-client-id',
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? 'dev-google-secret',
        redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://127.0.0.1:3000/api/v1/auth/google/callback',
      },
      youtube: {
        clientId: process.env.YOUTUBE_OAUTH_CLIENT_ID ?? 'dev-youtube-client-id',
        clientSecret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? 'dev-youtube-secret',
        redirectUri: process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? 'http://127.0.0.1:3000/api/v1/social-accounts/youtube/callback',
      },
      facebook: {
        clientId: process.env.FACEBOOK_OAUTH_CLIENT_ID ?? 'dev-facebook-client-id',
        clientSecret: process.env.FACEBOOK_OAUTH_CLIENT_SECRET ?? 'dev-facebook-secret',
        redirectUri: process.env.FACEBOOK_OAUTH_REDIRECT_URI ?? 'http://127.0.0.1:3000/api/v1/social-accounts/facebook/callback',
      },
      instagram: {
        clientId: process.env.INSTAGRAM_OAUTH_CLIENT_ID ?? process.env.FACEBOOK_OAUTH_CLIENT_ID ?? 'dev-ig-client-id',
        clientSecret: process.env.INSTAGRAM_OAUTH_CLIENT_SECRET ?? process.env.FACEBOOK_OAUTH_CLIENT_SECRET ?? 'dev-ig-secret',
        redirectUri: process.env.INSTAGRAM_OAUTH_REDIRECT_URI ?? 'http://127.0.0.1:3000/api/v1/social-accounts/instagram/callback',
      },
      tiktok: {
        clientKey: process.env.TIKTOK_CLIENT_KEY ?? 'dev-tt-client-key',
        clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? 'dev-tt-secret',
        redirectUri: process.env.TIKTOK_REDIRECT_URI ?? 'http://127.0.0.1:3000/api/v1/social-accounts/tiktok/callback',
      },
    },
    web: {
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3020',
    },
    agent: {
      wsUrl: process.env.AGENT_WS_URL ?? 'ws://localhost:3000',
      pairCodeTtlSec: process.env.AGENT_PAIR_CODE_TTL_SEC ?? 300,
      tokenExpiration: process.env.AGENT_TOKEN_EXPIRATION ?? '365d',
    },
    sentry: {
      dsn: process.env.SENTRY_DSN || undefined,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      release: process.env.GIT_SHA || undefined,
      tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
      profilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_placeholder',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
      pricePerCredit: process.env.STRIPE_PRICE_PER_CREDIT ?? 1000,
      planPriceIds: {
        pro: process.env.STRIPE_PRICE_ID_PRO ?? '',
        business: process.env.STRIPE_PRICE_ID_BUSINESS ?? '',
        enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? '',
      },
      successUrl: process.env.STRIPE_SUCCESS_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3020'}/billing?status=success`,
      cancelUrl: process.env.STRIPE_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3020'}/billing?status=cancel`,
    },
    notification: {
      resendApiKey: process.env.RESEND_API_KEY ?? '',
      fromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? 'no-reply@sociflow.io',
      fromName: process.env.NOTIFICATION_FROM_NAME ?? 'Sociflow',
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3020',
      creditLowThreshold: process.env.NOTIFICATION_CREDIT_LOW_THRESHOLD ?? 20,
      vapidPublicKey: process.env.NOTIFICATION_VAPID_PUBLIC_KEY ?? '',
      vapidPrivateKey: process.env.NOTIFICATION_VAPID_PRIVATE_KEY ?? '',
      vapidSubject: process.env.NOTIFICATION_VAPID_SUBJECT ?? 'mailto:admin@sociflow.io',
    },
  }

  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[config] Validation failed:')
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }
  return parsed.data
}

export const APP_CONFIG = 'APP_CONFIG'
