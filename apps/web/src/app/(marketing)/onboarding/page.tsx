import { Suspense } from 'react'
import { OnboardingView } from '@/features/onboarding'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Onboarding',
  description: 'Bắt đầu với Sociflow trong 3 bước: kết nối, soạn bài, xem analytics.',
  path: '/onboarding',
  noIndex: true,
})

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OnboardingView />
    </Suspense>
  )
}
