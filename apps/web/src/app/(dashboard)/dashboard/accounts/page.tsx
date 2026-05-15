import { AccountsView } from '@/features/accounts'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Accounts', path: '/dashboard/accounts', noIndex: true })

export default function AccountsPage() {
  return <AccountsView />
}
