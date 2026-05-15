import { RuleFormView } from '@/features/auto-reply'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Sửa rule', path: '/dashboard/auto-reply/:id', noIndex: true })

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditAutoReplyPage({ params }: PageProps) {
  const { id } = await params
  return <RuleFormView ruleId={id} />
}
