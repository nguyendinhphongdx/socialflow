import { Module } from '@nestjs/common'
import { StorageModule } from '@sociflow/storage'
import { APP_CONFIG, type AppConfig } from '../../config'

@Module({
  imports: [
    StorageModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        endpoint: config.storage.endpoint,
        region: config.storage.region,
        bucket: config.storage.bucket,
        accessKey: config.storage.accessKey,
        secretKey: config.storage.secretKey,
        publicUrl: config.storage.publicUrl,
        forcePathStyle: config.storage.type === 's3' && config.storage.endpoint.includes('localhost'),
      }),
    }),
  ],
  exports: [StorageModule],
})
export class StorageWireModule {}
