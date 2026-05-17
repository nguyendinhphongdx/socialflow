import type { AccountPlatform, PublishMode } from '../types'

export type WizardStep
  = | { kind: 'platform' }
    | { kind: 'mode', platform: AccountPlatform }
    | { kind: 'connect', platform: AccountPlatform, mode: PublishMode }
    | { kind: 'success', platform: AccountPlatform, mode: PublishMode }

export type WizardAction
  = | { type: 'select-platform', platform: AccountPlatform }
    | { type: 'select-mode', mode: PublishMode }
    | { type: 'mark-success' }
    | { type: 'back' }
    | { type: 'reset' }

export const RECOMMENDED_MODE: Record<AccountPlatform, PublishMode> = {
  YOUTUBE: 'API',
  TIKTOK: 'AUTOMATION',
  FACEBOOK: 'HYBRID',
  INSTAGRAM: 'HYBRID',
}

export const initialState: WizardStep = { kind: 'platform' }

export function wizardReducer(state: WizardStep, action: WizardAction): WizardStep {
  switch (action.type) {
    case 'select-platform':
      return { kind: 'mode', platform: action.platform }
    case 'select-mode':
      if (state.kind !== 'mode') return state
      return { kind: 'connect', platform: state.platform, mode: action.mode }
    case 'mark-success':
      if (state.kind !== 'connect') return state
      return { kind: 'success', platform: state.platform, mode: state.mode }
    case 'back':
      if (state.kind === 'mode') return { kind: 'platform' }
      if (state.kind === 'connect') return { kind: 'mode', platform: state.platform }
      if (state.kind === 'success') return { kind: 'platform' }
      return state
    case 'reset':
      return initialState
    default:
      return state
  }
}
