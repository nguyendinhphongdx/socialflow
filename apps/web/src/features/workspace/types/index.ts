export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

export interface Workspace {
  id: string
  name: string
  slug: string
  isPersonal: boolean
  ownerId: string
  role: WorkspaceRole // user's role in this workspace
  memberCount: number
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  userId: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: WorkspaceRole
  joinedAt: string
}

export interface InviteMemberInput {
  email: string
  role: Exclude<WorkspaceRole, 'OWNER'>
}
