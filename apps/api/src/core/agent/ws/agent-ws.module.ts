import { Module } from '@nestjs/common'
import { AgentModule } from '../agent.module'
import { AgentGateway } from './agent.gateway'
import { AgentRegistryService } from './agent-registry.service'
import { AgentDispatcherService } from './agent-dispatcher.service'
import { AutomationTaskRepository } from './automation-task.repository'
import { AutomationTaskService } from './automation-task.service'

/**
 * Module WS cho extension agent. Wire:
 * - AgentGateway: Socket.IO namespace `/agents`
 * - AgentRegistryService: Redis-backed online registry
 * - AgentDispatcherService: gửi command xuống agent (consume bởi PublishConsumer phase J7)
 * - AutomationTaskRepository/Service: lifecycle task
 *
 * Phụ thuộc AgentModule để inject AgentService + AgentRepository.
 */
@Module({
  imports: [AgentModule],
  providers: [
    AgentGateway,
    AgentRegistryService,
    AgentDispatcherService,
    AutomationTaskRepository,
    AutomationTaskService,
  ],
  exports: [
    AgentDispatcherService,
    AutomationTaskService,
    AgentRegistryService,
  ],
})
export class AgentWsModule {}
