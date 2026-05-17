import type { FC } from 'react'
import type { CredentialSource } from '../types'

interface BadgeStyle {
  text: string
  className: string
}

const STYLES: Record<CredentialSource, BadgeStyle> = {
  WORKSPACE: {
    text: 'Workspace custom',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  SYSTEM: {
    text: 'System',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  ENV: {
    text: 'Default (env)',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  NONE: {
    text: 'Not configured',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
}

export const OAuthCredentialStatusBadge: FC<{ source: CredentialSource }> = ({ source }) => {
  const style = STYLES[source]
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${style.className}`}>
      {style.text}
    </span>
  )
}
