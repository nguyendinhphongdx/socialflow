import { Global, Module } from '@nestjs/common'
import { OAuthCredentialController } from './oauth-credential.controller'
import { AiCredentialController } from './ai-credential.controller'
import { OAuthCredentialService } from './oauth-credential.service'
import { AiCredentialService } from './ai-credential.service'
import { OAuthCredentialRepository } from './oauth-credential.repository'
import { AiCredentialRepository } from './ai-credential.repository'
import { OAuthCredentialResolver } from './oauth-credential-resolver'
import { AiCredentialResolver } from './ai-credential-resolver'
import { CredentialScheduler } from './credential.scheduler'

/**
 * @Global vì:
 * - OAuthCredentialResolver inject vào youtube/facebook/instagram/tiktok-connect.service
 *   của SocialAccountModule.
 * - AiCredentialResolver + AiCredentialService inject vào AiService trong AiModule.
 *
 * Tránh boilerplate import chéo nhiều chỗ — pattern tương tự WorkspaceModule.
 */
@Global()
@Module({
  controllers: [OAuthCredentialController, AiCredentialController],
  providers: [
    OAuthCredentialService,
    OAuthCredentialRepository,
    OAuthCredentialResolver,
    AiCredentialService,
    AiCredentialRepository,
    AiCredentialResolver,
    CredentialScheduler,
  ],
  exports: [
    OAuthCredentialService,
    OAuthCredentialResolver,
    AiCredentialService,
    AiCredentialResolver,
  ],
})
export class CredentialModule {}
