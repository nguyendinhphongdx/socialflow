'use client'
import { useEffect, useReducer } from 'react'
import { useSearchParams } from 'next/navigation'
import { PlatformPicker } from '../wizard/PlatformPicker'
import { ModePicker } from '../wizard/ModePicker'
import { ConnectStep } from '../wizard/ConnectStep'
import { SuccessStep } from '../wizard/SuccessStep'
import { WizardSteps } from '../wizard/WizardSteps'
import { initialState, wizardReducer } from '../wizard/wizardState'
import type { AccountPlatform, PublishMode } from '../types'

function isPlatform(value: string | null): value is AccountPlatform {
  return value === 'YOUTUBE' || value === 'FACEBOOK' || value === 'INSTAGRAM' || value === 'TIKTOK'
}

function isMode(value: string | null): value is PublishMode {
  return value === 'API' || value === 'AUTOMATION' || value === 'HYBRID'
}

export function AccountConnectWizardView() {
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const search = useSearchParams()

  // OAuth callback hydration: if URL = ?step=success&platform=...&mode=..., jump straight to success
  useEffect(() => {
    if (search.get('step') !== 'success') return
    const platform = search.get('platform')
    const mode = search.get('mode')
    if (!isPlatform(platform) || !isMode(mode)) return
    dispatch({ type: 'select-platform', platform })
    dispatch({ type: 'select-mode', mode })
    dispatch({ type: 'mark-success' })
  }, [search])

  return (
    <main className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Connect tài khoản</h1>
        <p className="text-sm text-muted-foreground">
          Wizard 3 bước giúp bạn chọn platform + mode tối ưu cho use case.
        </p>
      </header>

      <WizardSteps current={state} />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {state.kind === 'platform' && (
          <PlatformPicker
            onSelect={platform => dispatch({ type: 'select-platform', platform })}
          />
        )}
        {state.kind === 'mode' && (
          <ModePicker
            platform={state.platform}
            onBack={() => dispatch({ type: 'back' })}
            onSelect={mode => dispatch({ type: 'select-mode', mode })}
          />
        )}
        {state.kind === 'connect' && (
          <ConnectStep
            platform={state.platform}
            mode={state.mode}
            onBack={() => dispatch({ type: 'back' })}
            onSuccess={() => dispatch({ type: 'mark-success' })}
          />
        )}
        {state.kind === 'success' && (
          <SuccessStep
            platform={state.platform}
            mode={state.mode}
            onReset={() => dispatch({ type: 'reset' })}
          />
        )}
      </div>
    </main>
  )
}
