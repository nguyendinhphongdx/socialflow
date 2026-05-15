import axios, { type InternalAxiosRequestConfig } from 'axios'

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
})

let refreshInFlight: Promise<void> | null = null
let refreshFailed = false

export function resetSession(): void {
  refreshInFlight = null
  refreshFailed = false
}

async function performRefresh(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = apiClient
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableConfig | undefined
    const status = error.response?.status
    if (refreshFailed || status !== 401 || !config || config._retry) {
      return Promise.reject(error)
    }
    if (config.url?.includes('/auth/refresh') || config.url?.includes('/auth/login')) {
      return Promise.reject(error)
    }
    config._retry = true
    try {
      await performRefresh()
      return apiClient(config)
    }
    catch (refreshErr) {
      refreshFailed = true
      if (typeof window !== 'undefined') {
        const nextPath = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?next=${nextPath}`
      }
      return Promise.reject(refreshErr)
    }
  },
)
