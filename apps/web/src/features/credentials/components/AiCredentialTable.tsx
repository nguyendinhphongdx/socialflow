'use client'
import { useState } from 'react'
import type { FC } from 'react'
import {
  useDeleteAiCredential,
  useVerifyAiCredential,
} from '../hooks/useAiCredentials'
import type { AiCredential, AiProvider, AiProviderStatus } from '../types'
import { OAuthCredentialStatusBadge } from './OAuthCredentialStatusBadge'
import { VerifyCredentialButton } from './VerifyCredentialButton'
import { AiBudgetMeter } from './AiBudgetMeter'

const PROVIDER_META: Record<AiProvider, { label: string, icon: string, accent: string }> = {
  OPENAI: { label: 'OpenAI', icon: 'OAI', accent: 'bg-teal-100 text-teal-700' },
  ANTHROPIC: { label: 'Anthropic', icon: 'ANT', accent: 'bg-orange-100 text-orange-700' },
  GOOGLE_GEMINI: { label: 'Google Gemini', icon: 'GEM', accent: 'bg-indigo-100 text-indigo-700' },
}

const ALL_PROVIDERS: AiProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI']

interface AiCredentialTableProps {
  statuses: AiProviderStatus[]
  credentials: AiCredential[]
  onConfigure: (provider: AiProvider, existing: AiCredential | null) => void
}

export const AiCredentialTable: FC<AiCredentialTableProps> = ({
  statuses,
  credentials,
  onConfigure,
}) => {
  const verify = useVerifyAiCredential()
  const remove = useDeleteAiCredential()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const statusByProvider = new Map(statuses.map(s => [s.provider, s]))
  const credByProvider = new Map(credentials.map(c => [c.provider, c]))

  return (
    <div className="space-y-3">
      {ALL_PROVIDERS.map((provider) => {
        const status = statusByProvider.get(provider)
        const credential = credByProvider.get(provider) ?? null
        const meta = PROVIDER_META[provider]
        const source = status?.source ?? 'NONE'
        const hasWorkspaceCustom = source === 'WORKSPACE'
        const monthSpent = Number(status?.monthSpentUsd ?? 0)
        const budget = status?.monthlyBudgetUsd != null ? Number(status.monthlyBudgetUsd) : null

        return (
          <div
            key={provider}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold ${meta.accent}`}>
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{meta.label}</p>
                    <OAuthCredentialStatusBadge source={source} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {hasWorkspaceCustom && status?.apiKeyLast4
                      ? `API key last4=${status.apiKeyLast4}${status.model ? ` · model=${status.model}` : ''}`
                      : source === 'ENV'
                        ? 'Đang dùng Sociflow default key'
                        : source === 'SYSTEM'
                          ? 'Đang dùng system key'
                          : 'Chưa cấu hình — AI gen sẽ thất bại'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {credential && (
                  <VerifyCredentialButton
                    onVerify={() => verify.mutate(credential.id)}
                    isLoading={verify.isPending && verify.variables === credential.id}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onConfigure(provider, credential)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {hasWorkspaceCustom ? 'Sửa' : 'Cấu hình'}
                </button>
                {hasWorkspaceCustom && credential && confirmId !== credential.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmId(credential.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Xoá
                  </button>
                )}
                {hasWorkspaceCustom && credential && confirmId === credential.id && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1">
                    <span className="text-xs">AI gen sẽ fallback về default key. Tiếp tục?</span>
                    <button
                      type="button"
                      onClick={() => {
                        remove.mutate(credential.id, { onSettled: () => setConfirmId(null) })
                      }}
                      disabled={remove.isPending}
                      className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                    >
                      {remove.isPending ? 'Đang xoá...' : 'Xoá'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="text-xs hover:underline"
                    >
                      Huỷ
                    </button>
                  </div>
                )}
              </div>
            </div>

            {hasWorkspaceCustom && (
              <div className="border-t border-border pt-3">
                <AiBudgetMeter spent={monthSpent} budget={budget} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
