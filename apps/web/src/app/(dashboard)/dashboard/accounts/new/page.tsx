import { AccountConnectWizardView } from '@/features/accounts'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Connect tài khoản',
  path: '/dashboard/accounts/new',
  noIndex: true,
})

export default function Page() {
  return <AccountConnectWizardView />
}
