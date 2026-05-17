import type { FC } from 'react'
import type { WizardStep } from './wizardState'

interface WizardStepsProps {
  current: WizardStep
}

const STEP_INDEX: Record<WizardStep['kind'], number> = {
  platform: 0,
  mode: 1,
  connect: 2,
  success: 3,
}

const STEPS = [
  { id: 'platform', label: 'Platform' },
  { id: 'mode', label: 'Mode' },
  { id: 'connect', label: 'Connect' },
  { id: 'success', label: 'Done' },
] as const

export const WizardSteps: FC<WizardStepsProps> = ({ current }) => {
  const activeIdx = STEP_INDEX[current.kind]

  return (
    <ol className="flex w-full items-center gap-2">
      {STEPS.map((step, idx) => {
        const isDone = idx < activeIdx
        const isActive = idx === activeIdx
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? '✓' : idx + 1}
            </div>
            <span
              className={`hidden text-xs sm:inline ${
                isActive ? 'font-semibold' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${isDone ? 'bg-emerald-600' : 'bg-border'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
