import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/layout/AuthGuard'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen">{children}</div>
    </AuthGuard>
  )
}
