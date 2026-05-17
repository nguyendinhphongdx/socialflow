'use client'
import { useState, type FC, type FormEvent } from 'react'

/**
 * Stub contact form — chưa wire BE. Log payload + toast confirm tạm thời.
 * Follow-up: connect tới /support/ticket endpoint khi support backend xong.
 */
export const ContactForm: FC = () => {
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }
    // eslint-disable-next-line no-console
    console.info('[help.contact] stub submit', data)
    setSubmitted(true)
    form.reset()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border bg-card p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Họ tên</span>
          <input
            name="name"
            required
            type="text"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Email</span>
          <input
            name="email"
            required
            type="email"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Nội dung</span>
        <textarea
          name="message"
          required
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Hoặc gửi mail trực tiếp tới{' '}
          <a href="mailto:support@sociflow.io" className="underline">
            support@sociflow.io
          </a>
        </p>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Gửi yêu cầu
        </button>
      </div>
      {submitted && (
        <p className="text-sm text-emerald-600" role="status">
          Đã ghi nhận yêu cầu (stub — chưa kết nối backend).
        </p>
      )}
    </form>
  )
}
