'use client'
import { useState, type KeyboardEvent } from 'react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
  placeholder?: string
}

export function TagInput({ value, onChange, maxTags = 10, placeholder = 'Thêm tag rồi nhấn Enter' }: TagInputProps) {
  const [draft, setDraft] = useState('')

  function commit() {
    const next = draft.trim().slice(0, 50)
    if (!next) return
    if (value.includes(next)) {
      setDraft('')
      return
    }
    if (value.length >= maxTags) return
    onChange([...value, next])
    setDraft('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
    else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function remove(tag: string) {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {value.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
          #{tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        maxLength={50}
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
      />
    </div>
  )
}
