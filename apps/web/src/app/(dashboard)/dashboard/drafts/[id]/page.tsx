import { DraftFormView } from '@/features/drafts'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Sửa bản nháp', path: '/dashboard/drafts/:id', noIndex: true })

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditDraftPage({ params }: PageProps) {
  const { id } = await params
  return <DraftFormView draftId={id} />
}
