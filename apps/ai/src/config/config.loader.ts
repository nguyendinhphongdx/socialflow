import { type AppConfig, ConfigSchema } from './config.schema'

/**
 * Load + validate env → AppConfig cho apps/ai.
 *
 * Gọi 1 lần qua `AppConfigModule.forRoot` factory. Fail-fast với exit code 1.
 */
export function loadConfig(): AppConfig {
  const raw = {
    app: {
      env: process.env.NODE_ENV ?? 'development',
      port: process.env.AI_PORT ?? 3001,
    },
    internal: {
      token: process.env.INTERNAL_TOKEN ?? '',
    },
    ai: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || undefined,
        textModel: process.env.OPENAI_TEXT_MODEL || undefined,
        imageModel: process.env.OPENAI_IMAGE_MODEL || undefined,
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || undefined,
        textModel: process.env.ANTHROPIC_TEXT_MODEL || undefined,
      },
      defaults: {
        textProvider: process.env.AI_DEFAULT_TEXT_PROVIDER || undefined,
        imageProvider: process.env.AI_DEFAULT_IMAGE_PROVIDER || undefined,
      },
    },
  }

  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[ai/config] Validation failed:')
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }
  return parsed.data
}

export const APP_CONFIG = 'APP_CONFIG'
