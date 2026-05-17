'use client'
import { useState } from 'react'
import { useCreateWorkspace, useCurrentWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import { MembersList } from '../components/MembersList'

export function WorkspaceSettingsView() {
  const { data: workspaces = [] } = useWorkspaces()
  const { data: current } = useCurrentWorkspace()
  const create = useCreateWorkspace()
  const [name, setName] = useState('')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    create.mutate(name.trim(), {
      onSuccess: () => setName(''),
    })
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Quản lý workspace</h1>
        <p className="text-sm text-muted-foreground">Tạo + mời thành viên + phân quyền</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tất cả workspace của bạn</h2>
        <ul className="space-y-1 rounded-md border border-border">
          {workspaces.map(ws => (
            <li
              key={ws.id}
              className="flex items-center justify-between border-b border-border/50 px-3 py-2 last:border-0"
            >
              <div>
                <div className="font-medium">{ws.name}</div>
                <div className="text-xs text-muted-foreground">
                  {ws.memberCount} thành viên · {ws.role}
                  {ws.isPersonal && ' · Personal'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tạo workspace mới</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="Tên workspace (vd: Brand X)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? 'Đang tạo...' : 'Tạo'}
          </button>
        </form>
      </section>

      {current && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            Workspace hiện tại: {current.name}
          </h2>
          <MembersList workspace={current} />
        </section>
      )}
    </div>
  )
}
