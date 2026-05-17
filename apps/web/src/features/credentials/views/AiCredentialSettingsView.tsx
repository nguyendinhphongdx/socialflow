'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  useAiCredentialStatus,
  useAiCredentials,
} from '../hooks/useAiCredentials'
import { AiCredentialTable } from '../components/AiCredentialTable'
import { AiCredentialForm } from '../components/AiCredentialForm'
import type { AiCredential, AiProvider } from '../types'

interface EditState {
  provider: AiProvider
  existing: AiCredential | null
}

export function AiCredentialSettingsView() {
  const credentials = useAiCredentials()
  const statuses = useAiCredentialStatus()
  const [editing, setEditing] = useState<EditState | null>(null)

  const handleConfigure = (provider: AiProvider, existing: AiCredential | null) => {
    setEditing({ provider, existing })
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/settings" className="hover:underline">Settings</Link>
          <span>/</span>
          <span>AI Credentials</span>
        </div>
        <h1 className="text-2xl font-bold">AI Credentials</h1>
        <p className="text-sm text-muted-foreground">
          Tự cung cấp API key OpenAI/Anthropic để track cost riêng + tránh share rate limit của Sociflow.
        </p>
      </header>

      <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <p className="font-medium text-emerald-900 dark:text-emerald-100">Lợi ích BYOK</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-900/80 dark:text-emerald-100/80">
          <li>Track cost từng workspace tách biệt</li>
          <li>Đặt monthly budget cap → tránh chi vượt</li>
          <li>Dùng custom base URL (Cloudflare AI Gateway) để cache + rate-limit</li>
          <li>Override model mặc định (vd: gpt-4o-mini cho cheap, claude-3-5-sonnet cho premium)</li>
        </ul>
      </section>

      {credentials.isLoading || statuses.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <AiCredentialTable
          statuses={statuses.data ?? []}
          credentials={credentials.data ?? []}
          onConfigure={handleConfigure}
        />
      )}

      {editing && (
        <AiCredentialForm
          provider={editing.provider}
          existing={editing.existing}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  )
}
