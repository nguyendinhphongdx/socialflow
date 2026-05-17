'use client'
import { type FC, useState } from 'react'
import { Check, ChevronDown, Plus, Users } from 'lucide-react'
import {
  useCurrentWorkspace,
  useSwitchWorkspace,
  useWorkspaces,
} from '../hooks/useWorkspaces'

export const WorkspaceSwitcher: FC = () => {
  const [open, setOpen] = useState(false)
  const { data: workspaces = [] } = useWorkspaces()
  const { data: current } = useCurrentWorkspace()
  const switchTo = useSwitchWorkspace()

  if (!current) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
      >
        <span className="flex items-center gap-2 truncate">
          <Users className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{current.name}</span>
          {current.isPersonal && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Personal</span>
          )}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover p-1 shadow-md">
            {workspaces.map(ws => (
              <button
                type="button"
                key={ws.id}
                onClick={() => {
                  switchTo(ws.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate">{ws.name}</span>
                  {ws.isPersonal && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Personal
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{ws.role.toLowerCase()}</span>
                  {ws.id === current.id && <Check className="size-4 text-primary" />}
                </span>
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <a
              href="/dashboard/settings/workspaces/new"
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
            >
              <Plus className="size-4" />
              <span>Tạo workspace mới</span>
            </a>
            <a
              href="/dashboard/settings/workspaces"
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <Users className="size-4" />
              <span>Quản lý thành viên</span>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
