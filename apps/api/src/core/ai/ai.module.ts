import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { CreditsModule } from '../credits/credits.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

/**
 * CredentialModule là @Global → AiCredentialResolver + AiCredentialService
 * tự inject. Không cần import ở đây.
 */
@Module({
  imports: [UserModule, CreditsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
