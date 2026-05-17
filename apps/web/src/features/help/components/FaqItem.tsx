import type { FC } from 'react'

export interface FaqItemProps {
  question: string
  answer: string
}

export const FaqItem: FC<FaqItemProps> = ({ question, answer }) => {
  return (
    <details className="group rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer list-none font-medium">
        <span className="inline-flex w-full items-center justify-between gap-4">
          {question}
          <span
            className="text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{answer}</p>
    </details>
  )
}
