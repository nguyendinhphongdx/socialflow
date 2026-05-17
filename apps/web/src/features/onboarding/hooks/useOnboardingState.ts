'use client'
import { useCallback, useEffect, useState } from 'react'

export type OnboardingStep = 'connect' | 'compose' | 'analytics'

export interface OnboardingState {
  currentStep: OnboardingStep
  completed: Record<OnboardingStep, boolean>
}

const STORAGE_KEY = 'sf_onboarding_state_v1'
const STEPS: OnboardingStep[] = ['connect', 'compose', 'analytics']

const DEFAULT_STATE: OnboardingState = {
  currentStep: 'connect',
  completed: { connect: false, compose: false, analytics: false },
}

function readState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      currentStep: parsed.currentStep ?? DEFAULT_STATE.currentStep,
      completed: { ...DEFAULT_STATE.completed, ...(parsed.completed ?? {}) },
    }
  }
  catch {
    return DEFAULT_STATE
  }
}

function persistState(state: OnboardingState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  catch {
    // ignore quota errors
  }
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(readState())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) persistState(state)
  }, [state, hydrated])

  const goTo = useCallback((step: OnboardingStep) => {
    setState((prev) => ({ ...prev, currentStep: step }))
  }, [])

  const markComplete = useCallback((step: OnboardingStep) => {
    setState((prev) => ({
      ...prev,
      completed: { ...prev.completed, [step]: true },
    }))
  }, [])

  const next = useCallback(() => {
    setState((prev) => {
      const idx = STEPS.indexOf(prev.currentStep)
      const nextStep = STEPS[idx + 1] ?? prev.currentStep
      return {
        ...prev,
        completed: { ...prev.completed, [prev.currentStep]: true },
        currentStep: nextStep,
      }
    })
  }, [])

  const reset = useCallback(() => {
    setState(DEFAULT_STATE)
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  const currentIndex = STEPS.indexOf(state.currentStep)
  const isLastStep = currentIndex === STEPS.length - 1

  return {
    state,
    hydrated,
    currentIndex,
    totalSteps: STEPS.length,
    isLastStep,
    goTo,
    markComplete,
    next,
    reset,
  }
}

export const ONBOARDING_STEPS = STEPS
