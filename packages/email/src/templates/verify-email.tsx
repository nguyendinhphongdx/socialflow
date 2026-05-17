import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { EmailLayout } from '../components/layout'
import type { VerifyEmailProps } from '../types'

const SUBJECT = 'Xác minh email tài khoản Sociflow'

export function VerifyEmail(props: VerifyEmailProps): React.ReactElement {
  const { name, verifyUrl, expireAt, appUrl } = props
  const expireText = new Date(expireAt).toLocaleString('vi-VN')

  return (
    <EmailLayout
      preview="Xác minh email để bắt đầu sử dụng Sociflow"
      appUrl={appUrl}
    >
      <Heading className="m-0 mb-4 text-xl font-semibold text-slate-800">
        Chào {name},
      </Heading>
      <Text className="m-0 mb-4 text-slate-700">
        Cảm ơn bạn đã đăng ký Sociflow. Hãy xác minh địa chỉ email để kích hoạt
        tài khoản và bắt đầu kết nối các kênh mạng xã hội.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={verifyUrl}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white"
        >
          Xác minh email
        </Button>
      </Section>
      <Text className="m-0 text-xs text-slate-500">
        Link có hiệu lực đến {expireText}. Nếu bạn không tạo tài khoản, hãy bỏ
        qua email này.
      </Text>
    </EmailLayout>
  )
}

VerifyEmail.subject = SUBJECT
