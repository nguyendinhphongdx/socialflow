import { AiCredentialSettingsView } from '@/features/credentials'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'AI Credentials',
  path: '/dashboard/settings/ai-credentials',
  noIndex: true,
})

export default function Page() {
  return <AiCredentialSettingsView />
}
