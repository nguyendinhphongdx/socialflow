import type { FC } from 'react'
import { PLAN_LABELS } from '../constants'
import type { PlanTier } from '../types'

const TIER_COLORS: Record<PlanTier, string> = {
  FREE: 'bg-muted text-muted-foreground',
  PRO: 'bg-primary/10 text-primary',
  BUSINESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  ENTERPRISE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
}

interface PlanBadgeProps {
  tier: PlanTier
  className?: string
}

export const PlanBadge: FC<PlanBadgeProps> = ({ tier, className }) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[tier]} ${className ?? ''}`}
    >
      {PLAN_LABELS[tier]}
    </span>
  )
}
