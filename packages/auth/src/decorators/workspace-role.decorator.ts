import { SetMetadata } from '@nestjs/common'
import { WORKSPACE_ROLE_KEY } from '../guards/workspace-context.guard'

export type WorkspaceRoleName = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

/**
 * Yêu cầu role tối thiểu để gọi endpoint trong context workspace hiện tại.
 *
 * Hierarchy: OWNER > ADMIN > EDITOR > VIEWER. `@RequireWorkspaceRole('ADMIN')`
 * cho phép ADMIN + OWNER, từ chối EDITOR / VIEWER.
 */
export const RequireWorkspaceRole = (role: WorkspaceRoleName): MethodDecorator & ClassDecorator =>
  SetMetadata(WORKSPACE_ROLE_KEY, role)
