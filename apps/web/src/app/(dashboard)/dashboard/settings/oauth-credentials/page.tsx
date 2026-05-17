import { OAuthCredentialSettingsView } from '@/features/credentials'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'OAuth Credentials',
  path: '/dashboard/settings/oauth-credentials',
  noIndex: true,
})

export default function Page() {
  return <OAuthCredentialSettingsView />
}
