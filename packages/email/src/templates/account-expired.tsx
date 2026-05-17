import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { EmailLayout } from '../components/layout'
import type { AccountExpiredEmailProps } from '../types'

const SUBJECT = 'Tài khoản mạng xã hội cần kết nối lại'

export function AccountExpiredEmail(props: AccountExpiredEmailProps): React.ReactElement {
  const { name, platform, accountDisplayName, reconnectUrl, appUrl } = props

  return (
    <EmailLayout
      preview={`Token ${platform} đã hết hạn — kết nối lại để tiếp tục đăng bài`}
      appUrl={appUrl}
    >
      <Heading className="m-0 mb-4 text-xl font-semibold text-slate-800">
        Chào {name},
      </Heading>
      <Text className="m-0 mb-4 text-slate-700">
        Token uỷ quyền của tài khoản <strong>{accountDisplayName}</strong> trên
        nền tảng <strong>{platform}</strong> đã hết hạn hoặc bị thu hồi. Các
        bài đăng đang lên lịch sẽ bị tạm dừng cho đến khi bạn kết nối lại.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={reconnectUrl}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white"
        >
          Kết nối lại tài khoản
        </Button>
      </Section>
      <Text className="m-0 text-xs text-slate-500">
        Bạn cần đăng nhập lại với {platform} và cấp quyền cho Sociflow.
      </Text>
    </EmailLayout>
  )
}

AccountExpiredEmail.subject = SUBJECT
