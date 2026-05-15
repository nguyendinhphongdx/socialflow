import { forwardRef, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { CommentModule } from '../comment/comment.module'
import { AutoReplyRuleController } from './auto-reply-rule.controller'
import { AutoReplyRuleService } from './auto-reply-rule.service'
import { AutoReplyRuleRepository } from './auto-reply-rule.repository'
import { AutoReplyCommentRepository } from './auto-reply-comment.repository'
import { AutoReplyProcessor } from './auto-reply.processor'
import { AutoReplyConsumer } from './auto-reply.consumer'

/**
 * AutoReply module — gộp CRUD AutoReplyRule + event processor + queue consumer
 * vào 1 folder để tránh fragment (xem rules.md: many small files theo feature).
 *
 * Tích hợp CommentModule:
 *  - CommentService emit `comment.new` → AutoReplyProcessor lắng nghe.
 *  - CommentModule provide `COMMENT_REPLY_PORT` (= CommentService via useExisting)
 *    — Consumer inject token này để gọi `replyManually`.
 *
 * `forwardRef` để chống circular nếu sau này CommentModule cần import
 * AutoReplyModule (hiện không cần, nhưng safe để tránh phải refactor).
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AUTO_REPLY }),
    forwardRef(() => CommentModule),
  ],
  controllers: [AutoReplyRuleController],
  providers: [
    AutoReplyRuleService,
    AutoReplyRuleRepository,
    AutoReplyCommentRepository,
    AutoReplyProcessor,
    AutoReplyConsumer,
  ],
  exports: [AutoReplyRuleService],
})
export class AutoReplyModule {}
