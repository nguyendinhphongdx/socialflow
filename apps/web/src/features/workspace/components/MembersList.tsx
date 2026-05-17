'use client'
import { type FC, useState } from 'react'
import { useInviteMember, useWorkspaceMembers } from '../hooks/useWorkspaces'
import type { Workspace, WorkspaceRole } from '../types'

interface Props {
  workspace: Workspace
}

const ROLE_OPTIONS: Array<Exclude<WorkspaceRole, 'OWNER'>> = ['ADMIN', 'EDITOR', 'VIEWER']

export const MembersList: FC<Props> = ({ workspace }) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'OWNER'>>('EDITOR')
  const { data: members = [], isLoading } = useWorkspaceMembers(workspace.id)
  const invite = useInviteMember(workspace.id)

  const canManage = workspace.role === 'OWNER' || workspace.role === 'ADMIN'

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    invite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => setEmail(''),
      },
    )
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Đang tải...</div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Thành viên ({members.length})</h3>
        <ul className="space-y-1 rounded-md border border-border">
          {members.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 last:border-0">
              <div className="flex items-center gap-2">
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" className="size-8 rounded-full" />
                  : (
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs">
                      {(m.name?.[0] ?? m.email[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                <div>
                  <div className="text-sm font-medium">{m.name ?? m.email}</div>
                  {m.name && <div className="text-xs text-muted-foreground">{m.email}</div>}
                </div>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="space-y-2">
          <h3 className="text-sm font-semibold">Mời thành viên</h3>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as typeof role)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              type="submit"
              disabled={invite.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {invite.isPending ? 'Đang gửi...' : 'Mời'}
            </button>
          </div>
          {invite.isError && (
            <p className="text-sm text-destructive">
              {invite.error instanceof Error ? invite.error.message : 'Lỗi mời thành viên'}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
