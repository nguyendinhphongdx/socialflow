import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  CheckoutSessionResponse,
  CreateCheckoutInput,
  CreditBalanceData,
  CreditTransactionListResponse,
} from '../types'

export const billingService = {
  getBalance: async (): Promise<CreditBalanceData> => {
    const { data } = await apiClient.get<ApiResponse<CreditBalanceData>>('/credits/balance')
    return data.data
  },
  getHistory: async (params?: { page?: number, pageSize?: number }): Promise<CreditTransactionListResponse> => {
    const { data } = await apiClient.get<ApiResponse<CreditTransactionListResponse>>('/credits/history', { params })
    return data.data
  },
  createCheckoutSession: async (input: CreateCheckoutInput): Promise<CheckoutSessionResponse> => {
    const { data } = await apiClient.post<ApiResponse<CheckoutSessionResponse>>('/credits/checkout-session', input)
    return data.data
  },
  cancelSubscription: async (): Promise<void> => {
    await apiClient.post('/credits/cancel-subscription')
  },
}
