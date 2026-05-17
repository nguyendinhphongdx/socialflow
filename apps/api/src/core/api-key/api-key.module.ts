import { Module } from '@nestjs/common'
import { ContextModule } from '@sociflow/auth'
import { UserModule } from '../user/user.module'
import { ApiKeyController } from './api-key.controller'
import { ApiKeyService } from './api-key.service'
import { ApiKeyRepository } from './api-key.repository'
import { ApiKeyAuthGuard } from './api-key-auth.guard'

@Module({
  imports: [ContextModule, UserModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyRepository, ApiKeyAuthGuard],
  exports: [ApiKeyService, ApiKeyAuthGuard],
})
export class ApiKeyModule {}
