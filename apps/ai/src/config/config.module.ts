import { Global, Module } from '@nestjs/common'
import { APP_CONFIG, loadConfig } from './config.loader'

/**
 * Global config — inject `APP_CONFIG` token để lấy validated config.
 *
 * ```ts
 * constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
 * ```
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
