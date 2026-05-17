import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import {
  ContextModule,
  WorkspaceContextGuard,
  WORKSPACE_MEMBERSHIP_RESOLVER,
} from '@sociflow/auth'
import { UserModule } from '../user/user.module'
import { WorkspaceController } from './workspace.controller'
import { WorkspaceService } from './workspace.service'
import { WorkspaceRepository } from './workspace.repository'

/**
 * @Global vì `WorkspaceService` cũng được dùng như `WorkspaceMembershipResolver`
 * cho `WorkspaceContextGuard` (APP_GUARD). Tránh việc mỗi module phải import lại.
 */
@Global()
@Module({
  imports: [ContextModule, UserModule],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceRepository,
    { provide: WORKSPACE_MEMBERSHIP_RESOLVER, useExisting: WorkspaceService },
    { provide: APP_GUARD, useClass: WorkspaceContextGuard },
  ],
  exports: [WorkspaceService, WorkspaceRepository, WORKSPACE_MEMBERSHIP_RESOLVER],
})
export class WorkspaceModule {}
