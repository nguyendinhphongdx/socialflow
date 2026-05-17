'use client'
import type { FC } from 'react'
import { ONBOARDING_STEPS, type OnboardingStep } from '../hooks/useOnboardingState'

interface StepIndicatorProps {
  currentStep: OnboardingStep
  completed: Record<OnboardingStep, boolean>
  onStepClick?: (step: OnboardingStep) => void
}

const STEP_LABELS: Record<OnboardingStep, string> = {
  connect: 'Kết nối tài khoản',
  compose: 'Tạo bài đăng đầu tiên',
  analytics: 'Xem analytics',
}

export const StepIndicator: FC<StepIndicatorProps> = ({ currentStep, completed, onStepClick }) => {
  return (
    <ol className="flex w-full items-center" aria-label="Tiến độ onboarding">
      {ONBOARDING_STEPS.map((step, index) => {
        const isCurrent = step === currentStep
        const isDone = completed[step]
        const isLast = index === ONBOARDING_STEPS.length - 1
        const clickable = isDone || isCurrent

        return (
          <li key={step} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <button
              type="button"
              onClick={() => clickable && onStepClick?.(step)}
              disabled={!clickable}
              className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isDone
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border bg-card text-muted-foreground'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L4 10.4a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  isCurrent ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </button>
            {!isLast && (
              <span
                className={`mx-2 h-px flex-1 transition-colors ${
                  isDone ? 'bg-emerald-500' : 'bg-border'
                }`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
