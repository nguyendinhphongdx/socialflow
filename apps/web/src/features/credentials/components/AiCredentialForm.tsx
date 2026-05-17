'use client'
import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { useUpsertAiCredential } from '../hooks/useAiCredentials'
import type { AiCredential, AiCredentialInput, AiProvider } from '../types'

interface AiCredentialFormProps {
  provider: AiProvider
  existing: AiCredential | null
  onClose: () => void
}

const PROVIDER_LABEL: Record<AiProvider, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  GOOGLE_GEMINI: 'Google Gemini',
}

const DEFAULT_MODEL: Record<AiProvider, string> = {
  OPENAI: 'gpt-4o-mini',
  ANTHROPIC: 'claude-3-5-sonnet-latest',
  GOOGLE_GEMINI: 'gemini-1.5-flash',
}

export const AiCredentialForm: FC<AiCredentialFormProps> = ({
  provider,
  existing,
  onClose,
}) => {
  const upsert = useUpsertAiCredential()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [budgetText, setBudgetText] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setApiKey('')
    setModel(existing?.model ?? '')
    setBaseUrl(existing?.baseUrl ?? '')
    setBudgetText(existing?.monthlyBudgetUsd != null ? String(existing.monthlyBudgetUsd) : '')
    setNotes(existing?.notes ?? '')
    setError(null)
  }, [existing, provider])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!existing && !apiKey.trim()) {
      setError('API Key là bắt buộc')
      return
    }
    let monthlyBudgetUsd: number | null | undefined
    if (budgetText.trim()) {
      const n = Number(budgetText)
      if (!Number.isFinite(n) || n < 0) {
        setError('Budget không hợp lệ')
        return
      }
      monthlyBudgetUsd = n
    }
    else {
      monthlyBudgetUsd = null
    }
    const input: AiCredentialInput = {
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      monthlyBudgetUsd,
      notes: notes.trim() || undefined,
    }
    if (!apiKey.trim() && existing) {
      delete (input as Partial<AiCredentialInput>).apiKey
    }
    upsert.mutate(input, {
      onSuccess: () => onClose(),
      onError: (err: unknown) => {
        const message
          = err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Lưu thất bại'
        setError(message)
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">
            {existing ? 'Sửa' : 'Cấu hình'} AI — {PROVIDER_LABEL[provider]}
          </h2>
          <p className="text-xs text-muted-foreground">
            API key được mã hoá AES-256-GCM trước khi lưu.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              API Key {existing ? '(để trống nếu không đổi)' : '*'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={existing ? `•••••••• last4=${existing.apiKeyLast4}` : 'sk-...'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Default model (optional)</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={DEFAULT_MODEL[provider]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Custom base URL (optional)</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="vd: https://gateway.ai.cloudflare.com/v1/.../openai"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Dùng Cloudflare AI Gateway hoặc proxy riêng để rate-limit + cache.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Monthly budget (USD, optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={budgetText}
              onChange={e => setBudgetText(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="vd: 50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Disable provider khi vượt budget. Để trống = không giới hạn.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="vd: Brand X account"
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
