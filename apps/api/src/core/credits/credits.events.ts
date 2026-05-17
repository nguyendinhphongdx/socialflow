/**
 * Re-export event constants từ credits.constants.ts để các module khác (notification, ...)
 * import từ 1 chỗ tường minh.
 *
 * Notification module (Agent F5) listen `CREDIT_LOW_EVENT` để gửi nudge.
 */
export {
  CREDIT_LOW_EVENT,
  PLAN_LOW_BALANCE_THRESHOLD,
  type CreditLowEvent,
} from './credits.constants'
