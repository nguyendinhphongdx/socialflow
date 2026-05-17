import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { EmailLayout } from '../components/layout'
import type { PublishFailedEmailProps } from '../types'

const SUBJECT = 'Bài đăng của bạn không thành công'

export function PublishFailedEmail(props: PublishFailedEmailProps): React.ReactElement {
  const { name, platform, postTitle, errorMessage, retryUrl, appUrl } = props
  const titleText = postTitle ?? '(không có tiêu đề)'

  return (
    <EmailLayout
      preview={`Bài đăng "${titleText}" trên ${platform} thất bại`}
      appUrl={appUrl}
    >
      <Heading className="m-0 mb-4 text-xl font-semibold text-slate-800">
        Chào {name},
      </Heading>
      <Text className="m-0 mb-2 text-slate-700">
        Một bài đăng của bạn trên <strong>{platform}</strong> đã không được đăng
        thành công.
      </Text>
      <Section className="my-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <Text className="m-0 mb-1 text-xs text-slate-500">Tiêu đề</Text>
        <Text className="m-0 mb-3 text-slate-800">{titleText}</Text>
        <Text className="m-0 mb-1 text-xs text-slate-500">Lỗi</Text>
        <Text className="m-0 text-slate-800">{errorMessage}</Text>
      </Section>
      <Section className="my-6 text-center">
        <Button
          href={retryUrl}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white"
        >
          Xem chi tiết & thử lại
        </Button>
      </Section>
      <Text className="m-0 text-xs text-slate-500">
        Bạn có thể tắt thông báo loại này trong cài đặt tài khoản.
      </Text>
    </EmailLayout>
  )
}

PublishFailedEmail.subject = SUBJECT
