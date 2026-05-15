import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ContextModule } from '@sociflow/auth'
import { AgentController } from './agent.controller'
import { AgentRepository } from './agent.repository'
import { AgentService } from './agent.service'

@Module({
  imports: [
    ContextModule,
    JwtModule.register({}),     // secret/expiry passed per-sign trong AgentService
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentRepository],
  exports: [AgentService],      // export Service cho WS Gateway sau này
})
export class AgentModule {}
