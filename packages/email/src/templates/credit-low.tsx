import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { EmailLayout } from '../components/layout'
import type { CreditLowEmailProps } from '../types'

const SUBJECT = 'AI credit sắp hết'

export function CreditLowEmail(props: CreditLowEmailProps): React.ReactElement {
  const { name, remainingCredits, threshold, topUpUrl, appUrl } = props

  return (
    <EmailLayout
      preview={`Còn ${remainingCredits} AI credit — nạp thêm để tiếp tục dùng tính năng AI`}
      appUrl={appUrl}
    >
      <Heading className="m-0 mb-4 text-xl font-semibold text-slate-800">
        Chào {name},
      </Heading>
      <Text className="m-0 mb-4 text-slate-700">
        Tài khoản của bạn còn <strong>{remainingCredits} AI credit</strong>{' '}
        (dưới ngưỡng cảnh báo {threshold}). Khi hết credit, các tính năng tạo
        nội dung AI sẽ tạm dừng.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={topUpUrl}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white"
        >
          Nạp thêm credit
        </Button>
      </Section>
      <Text className="m-0 text-xs text-slate-500">
        Bạn có thể nâng cấp gói để được cấp thêm credit hàng tháng.
      </Text>
    </EmailLayout>
  )
}

CreditLowEmail.subject = SUBJECT
