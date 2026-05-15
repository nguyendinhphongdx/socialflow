import { DraftPublishView } from '@/features/drafts'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Publish nháp', path: '/dashboard/drafts/:id/publish', noIndex: true })

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PublishDraftPage({ params }: PageProps) {
  const { id } = await params
  return <DraftPublishView draftId={id} />
}
