'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, type FC } from 'react'
import { StepAnalytics } from '../components/StepAnalytics'
import { StepCompose } from '../components/StepCompose'
import { StepConnectAccount } from '../components/StepConnectAccount'
import { StepIndicator } from '../components/StepIndicator'
import {
  ONBOARDING_STEPS,
  useOnboardingState,
  type OnboardingStep,
} from '../hooks/useOnboardingState'

function isValidStep(value: string | null): value is OnboardingStep {
  return value !== null && (ONBOARDING_STEPS as readonly string[]).includes(value)
}

export const OnboardingView: FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, hydrated, goTo, markComplete, next } = useOnboardingState()

  useEffect(() => {
    if (!hydrated) return
    const stepParam = searchParams.get('step')
    if (isValidStep(stepParam) && stepParam !== state.currentStep) {
      goTo(stepParam)
    }
  }, [hydrated, searchParams, state.currentStep, goTo])

  const handleConnectComplete = useCallback(() => {
    markComplete('connect')
  }, [markComplete])

  const handleComposeComplete = useCallback(() => {
    next()
  }, [next])

  const handleFinish = useCallback(() => {
    markComplete('analytics')
    router.push('/dashboard')
  }, [markComplete, router])

  const handleSkip = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              S
            </span>
            <span className="text-lg font-semibold tracking-tight">Sociflow</span>
          </Link>
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Bỏ qua →
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10">
          <p className="text-sm font-medium text-muted-foreground">Onboarding</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Bắt đầu với Sociflow trong 3 bước
          </h1>
        </div>

        <div className="mb-10">
          <StepIndicator
            currentStep={state.currentStep}
            completed={state.completed}
            onStepClick={goTo}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {state.currentStep === 'connect' && (
            <StepConnectAccount onComplete={handleConnectComplete} />
          )}
          {state.currentStep === 'compose' && <StepCompose onComplete={handleComposeComplete} />}
          {state.currentStep === 'analytics' && <StepAnalytics onFinish={handleFinish} />}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              const idx = ONBOARDING_STEPS.indexOf(state.currentStep)
              if (idx > 0) goTo(ONBOARDING_STEPS[idx - 1])
            }}
            disabled={state.currentStep === 'connect'}
            className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={next}
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            {state.currentStep === 'analytics' ? 'Hoàn tất' : 'Bước tiếp theo →'}
          </button>
        </div>
      </main>
    </div>
  )
}
