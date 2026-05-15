'use client'
import type { FC } from 'react'
import { useRevokeDevice } from '../hooks/useDevices'
import type { Agent } from '../types'

export const DeviceCard: FC<{ agent: Agent }> = ({ agent }) => {
  const revoke = useRevokeDevice()

  const lastSeenStr = agent.lastSeenAt
    ? new Date(agent.lastSeenAt).toLocaleString('vi-VN')
    : 'Chưa kết nối'

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl">
            {agent.type === 'EXTENSION' ? '🌐' : '🖥️'}
          </div>
          <div>
            <p className="font-semibold">{agent.browserName ?? agent.type}</p>
            <p className="text-xs text-muted-foreground">{agent.os ?? '—'} · v{agent.extensionVersion ?? '?'}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
          agent.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${agent.online ? 'bg-green-600' : 'bg-gray-400'}`} />
          {agent.online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>Agent ID: <code className="font-mono">{agent.publicId.slice(0, 12)}...</code></p>
        <p>Capabilities: {agent.capabilities.join(', ') || '—'}</p>
        <p>Last seen: {lastSeenStr}</p>
      </div>

      {!agent.revokedAt && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => revoke.mutate(agent.id)}
            disabled={revoke.isPending}
            className="text-xs text-destructive hover:underline"
          >
            Huỷ liên kết
          </button>
        </div>
      )}
    </div>
  )
}
