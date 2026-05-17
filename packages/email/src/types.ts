/**
 * Props shared cho mọi template + per-template props.
 * Mỗi template props phải JSON-serializable — payload đi qua queue.
 */
export interface BaseEmailProps {
  /** App URL gốc (https://app.sociflow.io) — render link footer */
  appUrl: string
}

export interface VerifyEmailProps extends BaseEmailProps {
  name: string
  verifyUrl: string
  expireAt: Date
}

export interface ResetPasswordEmailProps extends BaseEmailProps {
  name: string
  resetUrl: string
  expireAt: Date
}

export interface PublishFailedEmailProps extends BaseEmailProps {
  name: string
  platform: string
  postTitle: string | null
  errorMessage: string
  publishRecordId: string
  retryUrl: string
}

export interface AccountExpiredEmailProps extends BaseEmailProps {
  name: string
  platform: string
  accountDisplayName: string
  reconnectUrl: string
}

export interface CreditLowEmailProps extends BaseEmailProps {
  name: string
  remainingCredits: number
  threshold: number
  topUpUrl: string
}
