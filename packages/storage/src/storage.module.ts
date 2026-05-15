import { type DynamicModule, Global, Module } from '@nestjs/common'
import { STORAGE_CONFIG, StorageService } from './storage.service'
import type { StorageConfig } from './types'

interface StorageModuleAsyncOptions {
  inject?: unknown[]
  useFactory: (...args: unknown[]) => StorageConfig | Promise<StorageConfig>
}

@Global()
@Module({})
export class StorageModule {
  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_CONFIG,
          inject: options.inject as never,
          useFactory: options.useFactory as never,
        },
        StorageService,
      ],
      exports: [StorageService, STORAGE_CONFIG],
    }
  }
}
