'use client'
import { useMutation } from '@tanstack/react-query'
import { billingService } from '../services/billing.service'
import type { CreateCheckoutInput } from '../types'

export function useCheckout() {
  return useMutation({
    mutationFn: (input: CreateCheckoutInput) => billingService.createCheckoutSession(input),
  })
}
