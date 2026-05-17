import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { EmailLayout } from '../components/layout'
import type { ResetPasswordEmailProps } from '../types'

const SUBJECT = 'Đặt lại mật khẩu Sociflow'

export function ResetPasswordEmail(props: ResetPasswordEmailProps): React.ReactElement {
  const { name, resetUrl, expireAt, appUrl } = props
  const expireText = new Date(expireAt).toLocaleString('vi-VN')

  return (
    <EmailLayout
      preview="Đặt lại mật khẩu Sociflow của bạn"
      appUrl={appUrl}
    >
      <Heading className="m-0 mb-4 text-xl font-semibold text-slate-800">
        Chào {name},
      </Heading>
      <Text className="m-0 mb-4 text-slate-700">
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm
        vào nút bên dưới để tạo mật khẩu mới.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={resetUrl}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white"
        >
          Đặt lại mật khẩu
        </Button>
      </Section>
      <Text className="m-0 text-xs text-slate-500">
        Link có hiệu lực đến {expireText}. Nếu bạn không yêu cầu đặt lại mật
        khẩu, hãy bỏ qua email này hoặc liên hệ hỗ trợ.
      </Text>
    </EmailLayout>
  )
}

ResetPasswordEmail.subject = SUBJECT
