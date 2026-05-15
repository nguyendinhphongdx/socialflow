import { Module } from '@nestjs/common'
import { PublishModule } from '../publish/publish.module'
import { DraftController } from './draft.controller'
import { DraftRepository } from './draft.repository'
import { DraftService } from './draft.service'

@Module({
  imports: [PublishModule],
  controllers: [DraftController],
  providers: [DraftService, DraftRepository],
  exports: [DraftService],
})
export class DraftModule {}
