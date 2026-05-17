'use client'
import type { FC } from 'react'

interface VerifyCredentialButtonProps {
  onVerify: () => void
  isLoading: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
}

export const VerifyCredentialButton: FC<VerifyCredentialButtonProps> = ({
  onVerify,
  isLoading,
  disabled,
  size = 'sm',
}) => {
  const padding = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <button
      type="button"
      onClick={onVerify}
      disabled={disabled || isLoading}
      className={`inline-flex items-center gap-1 rounded-md border border-border bg-background ${padding} font-medium hover:bg-accent disabled:opacity-50`}
    >
      {isLoading ? 'Đang kiểm tra...' : 'Verify'}
    </button>
  )
}
