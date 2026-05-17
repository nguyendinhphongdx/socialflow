'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  useOAuthCredentialStatus,
  useOAuthCredentials,
} from '../hooks/useOAuthCredentials'
import { OAuthCredentialTable } from '../components/OAuthCredentialTable'
import { OAuthCredentialForm } from '../components/OAuthCredentialForm'
import type { AccountPlatform, OAuthCredential } from '../types'

interface EditState {
  platform: AccountPlatform
  existing: OAuthCredential | null
}

export function OAuthCredentialSettingsView() {
  const credentials = useOAuthCredentials()
  const statuses = useOAuthCredentialStatus()
  const [editing, setEditing] = useState<EditState | null>(null)

  const handleConfigure = (platform: AccountPlatform, existing: OAuthCredential | null) => {
    setEditing({ platform, existing })
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/settings" className="hover:underline">Settings</Link>
          <span>/</span>
          <span>OAuth Credentials</span>
        </div>
        <h1 className="text-2xl font-bold">OAuth Credentials</h1>
        <p className="text-sm text-muted-foreground">
          Cấu hình OAuth app riêng để dùng API mode mà không cần Sociflow App Review.
          {' '}
          <Link
            href="/docs/byok-overview"
            className="text-primary hover:underline"
          >
            Vì sao BYOK?
          </Link>
        </p>
      </header>

      <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900/40 dark:bg-blue-950/30">
        <p className="font-medium text-blue-900 dark:text-blue-100">Cách hoạt động</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-blue-900/80 dark:text-blue-100/80">
          <li>Tạo OAuth app trong platform dev console (YouTube/Meta/TikTok).</li>
          <li>Copy redirect URI bên dưới vào platform settings.</li>
          <li>Paste Client ID + Client Secret vào form.</li>
          <li>Click <b>Verify</b> để kiểm tra rồi connect account.</li>
        </ol>
      </section>

      {credentials.isLoading || statuses.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <OAuthCredentialTable
          statuses={statuses.data ?? []}
          credentials={credentials.data ?? []}
          onConfigure={handleConfigure}
        />
      )}

      {editing && (
        <OAuthCredentialForm
          platform={editing.platform}
          existing={editing.existing}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  )
}
