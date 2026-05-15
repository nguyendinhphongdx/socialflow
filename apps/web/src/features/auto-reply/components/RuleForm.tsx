'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAccounts, type AccountPlatform } from '@/features/accounts'
import { TagInput } from '@/features/drafts'
import { useCreateRule, useRule, useUpdateRule } from '../hooks/useAutoReply'
import type { CreateAutoReplyRuleInput } from '../types'

interface RuleFormProps {
  ruleId?: string
}

const PLATFORMS: AccountPlatform[] = ['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']

const DEFAULT_STATE: CreateAutoReplyRuleInput = {
  name: '',
  enabled: true,
  platforms: [],
  accountIds: [],
  keywordsAny: [],
  keywordsAll: [],
  keywordsNone: [],
  replyTemplate: '',
  replyDelaySec: 30,
  maxRepliesPerDay: 100,
}

export function RuleForm({ ruleId }: RuleFormProps) {
  const router = useRouter()
  const isEdit = Boolean(ruleId)

  const { data: existing, isLoading } = useRule(ruleId)
  const { data: accounts } = useAccounts({ pageSize: 100 })
  const create = useCreateRule()
  const update = useUpdateRule(ruleId ?? '')

  const [form, setForm] = useState<CreateAutoReplyRuleInput>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (existing && !hydrated) {
      setForm({
        name: existing.name,
        enabled: existing.enabled,
        platforms: existing.platforms,
        accountIds: existing.accountIds,
        keywordsAny: existing.keywordsAny,
        keywordsAll: existing.keywordsAll,
        keywordsNone: existing.keywordsNone,
        replyTemplate: existing.replyTemplate,
        replyDelaySec: existing.replyDelaySec,
        maxRepliesPerDay: existing.maxRepliesPerDay,
      })
      setHydrated(true)
    }
  }, [existing, hydrated])

  function patch<K extends keyof CreateAutoReplyRuleInput>(key: K, value: CreateAutoReplyRuleInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function togglePlatform(p: AccountPlatform) {
    const has = form.platforms.includes(p)
    patch('platforms', has ? form.platforms.filter(x => x !== p) : [...form.platforms, p])
  }

  function toggleAccount(id: string) {
    const has = form.accountIds.includes(id)
    patch('accountIds', has ? form.accountIds.filter(x => x !== id) : [...form.accountIds, id])
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.replyTemplate.trim()) return
    if (isEdit && ruleId) {
      update.mutate(form, { onSuccess: () => router.push('/dashboard/auto-reply') })
    }
    else {
      create.mutate(form, { onSuccess: () => router.push('/dashboard/auto-reply') })
    }
  }

  if (isEdit && isLoading) {
    return <p className="text-muted-foreground">Đang tải rule...</p>
  }

  const submitting = create.isPending || update.isPending

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? 'Sửa rule' : 'Tạo rule auto-reply'}</h1>
        <Link href="/dashboard/auto-reply" className="text-sm text-muted-foreground hover:underline">
          ← Danh sách
        </Link>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="name">Tên rule</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={e => patch('name', e.target.value)}
            maxLength={100}
            required
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        <section className="flex items-center gap-2">
          <input
            id="enabled"
            type="checkbox"
            checked={form.enabled}
            onChange={e => patch('enabled', e.target.checked)}
          />
          <label htmlFor="enabled" className="text-sm">Bật rule ngay</label>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Platforms (chọn rỗng = áp dụng tất cả)</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <label key={p} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={form.platforms.includes(p)}
                  onChange={() => togglePlatform(p)}
                />
                {p}
              </label>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Tài khoản (chọn rỗng = áp dụng tất cả)</p>
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
            {accounts?.list.map(a => (
              <label key={a.id} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={form.accountIds.includes(a.id)}
                  onChange={() => toggleAccount(a.id)}
                />
                <span className="truncate">{a.platform} · {a.displayName}</span>
              </label>
            ))}
            {!accounts?.list.length && (
              <p className="px-2 py-1 text-xs text-muted-foreground">Chưa có account nào.</p>
            )}
          </div>
        </section>

        <section>
          <label className="mb-1 block text-sm font-medium">Từ khoá - Bất kỳ (any)</label>
          <TagInput value={form.keywordsAny} onChange={v => patch('keywordsAny', v)} maxTags={30} placeholder="Match nếu chứa BẤT KỲ keyword nào..." />
        </section>

        <section>
          <label className="mb-1 block text-sm font-medium">Từ khoá - Đầy đủ (all)</label>
          <TagInput value={form.keywordsAll} onChange={v => patch('keywordsAll', v)} maxTags={30} placeholder="Match nếu chứa TẤT CẢ keyword..." />
        </section>

        <section>
          <label className="mb-1 block text-sm font-medium">Từ khoá - Loại trừ (none)</label>
          <TagInput value={form.keywordsNone} onChange={v => patch('keywordsNone', v)} maxTags={30} placeholder="KHÔNG match nếu chứa keyword..." />
        </section>

        <section>
          <label className="mb-1 block text-sm font-medium" htmlFor="template">Nội dung reply</label>
          <textarea
            id="template"
            value={form.replyTemplate}
            onChange={e => patch('replyTemplate', e.target.value)}
            rows={5}
            maxLength={2000}
            required
            placeholder={'Cảm ơn {{authorName}} đã comment bài "{{postTitle}}"!'}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Variables: <code>{'{{authorName}}'}</code>, <code>{'{{postTitle}}'}</code>
          </p>
        </section>

        <section>
          <label className="block text-sm font-medium" htmlFor="delay">
            Delay trước khi reply: {form.replyDelaySec}s
          </label>
          <input
            id="delay"
            type="range"
            min={0}
            max={3600}
            step={5}
            value={form.replyDelaySec}
            onChange={e => patch('replyDelaySec', Number(e.target.value))}
            className="mt-1 block w-full"
          />
        </section>

        <section>
          <label className="block text-sm font-medium" htmlFor="quota">Quota reply / ngày</label>
          <input
            id="quota"
            type="number"
            min={1}
            max={1000}
            value={form.maxRepliesPerDay}
            onChange={e => patch('maxRepliesPerDay', Number(e.target.value))}
            className="mt-1 block w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        <div className="flex gap-2 border-t border-border pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật rule' : 'Tạo rule')}
          </button>
        </div>
      </form>
    </div>
  )
}
