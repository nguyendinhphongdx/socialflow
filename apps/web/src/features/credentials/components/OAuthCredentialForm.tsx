'use client'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { buildRedirectUri } from '../services/oauth-credential.service'
import { useUpsertOAuthCredential } from '../hooks/useOAuthCredentials'
import type { AccountPlatform, OAuthCredential, OAuthCredentialInput } from '../types'

interface OAuthCredentialFormProps {
  platform: AccountPlatform
  existing: OAuthCredential | null
  onClose: () => void
  onSaved?: (credential: OAuthCredential) => void
}

const PLATFORM_LABEL: Record<AccountPlatform, string> = {
  YOUTUBE: 'YouTube (Google Cloud Console)',
  FACEBOOK: 'Facebook (Meta App)',
  INSTAGRAM: 'Instagram (Meta App)',
  TIKTOK: 'TikTok (Developer Portal)',
}

const SETUP_GUIDE_URL: Record<AccountPlatform, string> = {
  YOUTUBE: '/docs/oauth-setup-youtube',
  FACEBOOK: '/docs/oauth-setup-facebook',
  INSTAGRAM: '/docs/oauth-setup-instagram',
  TIKTOK: '/docs/oauth-setup-tiktok',
}

export const OAuthCredentialForm: FC<OAuthCredentialFormProps> = ({
  platform,
  existing,
  onClose,
  onSaved,
}) => {
  const upsert = useUpsertOAuthCredential()
  const redirectUri = buildRedirectUri(platform)
  const [copyOk, setCopyOk] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [scopesText, setScopesText] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setClientId(existing?.clientId ?? '')
    setClientSecret('')
    setScopesText((existing?.scopes ?? []).join('\n'))
    setNotes(existing?.notes ?? '')
    setError(null)
  }, [existing, platform])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!clientId.trim()) {
      setError('Client ID là bắt buộc')
      return
    }
    if (!existing && !clientSecret.trim()) {
      setError('Client Secret là bắt buộc')
      return
    }
    const input: OAuthCredentialInput = {
      platform,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      scopes: scopesText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
    }
    // Khi update mà user không nhập secret mới → bỏ field để backend giữ giá trị cũ
    if (!clientSecret.trim() && existing) {
      delete (input as Partial<OAuthCredentialInput>).clientSecret
    }
    upsert.mutate(input, {
      onSuccess: (cred) => {
        onSaved?.(cred)
        onClose()
      },
      onError: (err: unknown) => {
        const message
          = err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Lưu thất bại'
        setError(message)
      },
    })
  }

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    }
    catch {
      setError('Không copy được — hãy copy thủ công')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">
            {existing ? 'Sửa' : 'Cấu hình'} OAuth — {PLATFORM_LABEL[platform]}
          </h2>
          <a
            href={SETUP_GUIDE_URL[platform]}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Xem hướng dẫn tạo OAuth app →
          </a>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Redirect URI (copy vào platform dev console)</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={redirectUri}
                className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono"
              />
              <button
                type="button"
                onClick={copyRedirect}
                className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                {copyOk ? 'Đã copy' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Client ID *</label>
            <input
              type="text"
              required
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="vd: 12345-xxxxx.apps.googleusercontent.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Client Secret {existing ? '(để trống nếu không đổi)' : '*'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={existing ? `•••••••• last4=${existing.clientSecretLast4}` : 'Client secret từ platform'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Custom scopes (optional, 1 dòng/scope)</label>
            <textarea
              rows={3}
              value={scopesText}
              onChange={e => setScopesText(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
              placeholder="https://www.googleapis.com/auth/youtube.upload"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Để trống dùng scope mặc định của Sociflow.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="vd: Brand X OAuth app"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {upsert.isPending ? 'Đang lưu...' : 'Lưu credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
