import { PricingView } from '@/features/billing'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Pricing',
  description: 'Chọn gói phù hợp với bạn. Free, Pro, Business hoặc Enterprise.',
  path: '/pricing',
})

export default function Page() {
  return <PricingView />
}
