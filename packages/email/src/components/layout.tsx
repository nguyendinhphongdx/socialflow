import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'

interface LayoutProps {
  preview: string
  appUrl: string
  children: React.ReactNode
}

/**
 * Shell chung cho mọi email — header, footer (privacy/terms), brand color.
 *
 * Sociflow brand palette:
 *  - primary: #4F46E5 (indigo-600)
 *  - text: #1F2937 (slate-800)
 *  - muted: #6B7280 (slate-500)
 */
export function EmailLayout({ preview, appUrl, children }: LayoutProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-slate-100 font-sans">
          <Container className="mx-auto my-8 max-w-[560px] rounded-lg bg-white p-8">
            <Section className="mb-6">
              <Text className="m-0 text-2xl font-bold text-indigo-600">Sociflow</Text>
            </Section>

            {children}

            <Hr className="my-6 border-slate-200" />
            <Section>
              <Text className="m-0 text-xs text-slate-500">
                © {new Date().getFullYear()} Sociflow ·{' '}
                <Link href={`${appUrl}/legal/privacy`} className="text-slate-500 underline">
                  Privacy
                </Link>
                {' · '}
                <Link href={`${appUrl}/legal/terms`} className="text-slate-500 underline">
                  Terms
                </Link>
                {' · '}
                <Link href={`${appUrl}/settings/notifications`} className="text-slate-500 underline">
                  Notification settings
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
