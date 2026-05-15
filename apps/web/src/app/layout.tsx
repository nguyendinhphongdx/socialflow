import type { ReactNode } from 'react'
import { Providers } from './providers'
import { createMetadata } from '@/lib/seo/metadata'
import './globals.css'

export const metadata = createMetadata()

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
