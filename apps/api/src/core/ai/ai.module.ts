import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { CreditsModule } from '../credits/credits.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [UserModule, CreditsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
