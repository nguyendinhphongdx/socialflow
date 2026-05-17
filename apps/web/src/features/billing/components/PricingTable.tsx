import type { FC } from 'react'
import { PLAN_TIERS } from '../constants'
import type { PlanTier } from '../types'
import { PricingCard } from './PricingCard'

interface PricingTableProps {
  currentPlan?: PlanTier | null
}

export const PricingTable: FC<PricingTableProps> = ({ currentPlan }) => {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {PLAN_TIERS.map((plan) => (
        <PricingCard key={plan.id} plan={plan} currentPlan={currentPlan} />
      ))}
    </div>
  )
}
