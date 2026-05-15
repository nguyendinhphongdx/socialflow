import { PostInsightView } from '@/features/analytics'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Post insights', path: '/dashboard/analytics/posts/:id', noIndex: true })

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PostInsightPage({ params }: PageProps) {
  const { id } = await params
  return <PostInsightView publishRecordId={id} />
}
