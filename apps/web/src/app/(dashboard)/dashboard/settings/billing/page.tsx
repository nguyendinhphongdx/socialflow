import { BillingSettingsView } from '@/features/billing'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Billing',
  path: '/dashboard/settings/billing',
  noIndex: true,
})

export default function Page() {
  return <BillingSettingsView />
}
