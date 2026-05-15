---
name: add-fe-feature
description: Tạo feature folder mới trong apps/web/src/features/<domain>/ — components, hooks, services, types, views, barrel export. Use khi user yêu cầu "/add-fe-feature xxx" hoặc "tạo feature FE xxx".
---

# Skill: add-fe-feature

Tạo 1 feature folder chuẩn theo convention sociflow FE. Áp dụng [.claude/rules/frontend-architecture.md](../../rules/frontend-architecture.md).

## Inputs

1. **Feature name** (singular, kebab-case): `compose`, `inbox`, `agent-pairing`
2. **Có API endpoint backend chưa?** Nếu rồi → list endpoint dùng
3. **Views cần?** (List, Detail, Create form, ...). Mặc định: `ListView`, `DetailView`
4. **Stores cần?** (cross-component UI state)

## Output checklist

```
apps/web/src/features/<feature>/
├── components/
│   ├── <Feature>Card.tsx           # list item
│   ├── <Feature>Form.tsx           # RHF + zod
│   └── <Feature>EmptyState.tsx
├── hooks/
│   └── use<Feature>.ts             # TanStack Query: useList, useGet, useCreate, useUpdate, useDelete
├── services/
│   └── <feature>Service.ts         # axios calls (typed via ts-rest contract)
├── types/
│   └── index.ts                    # local types (extend từ @sociflow/common nếu cần)
├── views/
│   ├── <Feature>ListView.tsx
│   └── <Feature>DetailView.tsx
└── index.ts                        # public barrel export
```

Plus:
- [ ] Page route trong `app/(dashboard)/<feature>/page.tsx` gọi `<FeatureView />`
- [ ] `metadata` qua `createMetadata()` từ `lib/seo/`
- [ ] Type-check + lint pass

## Templates

### `index.ts` (barrel)

```ts
export { FeatureListView } from './views/FeatureListView'
export { FeatureDetailView } from './views/FeatureDetailView'
export { useFeatures, useFeature, useCreateFeature, useUpdateFeature, useDeleteFeature, featureKeys } from './hooks/useFeature'
export { featureService } from './services/featureService'
export type { Feature, FeatureCreateInput, FeatureUpdateInput } from './types'
```

### `services/featureService.ts`

```ts
import { apiClient } from '@/lib/api/client'
import type { Feature, FeatureCreateInput, FeatureUpdateInput, FeatureListQuery } from '../types'
import type { ApiSuccess, ApiList } from '@/lib/api/types'

export const featureService = {
  list: async (query?: FeatureListQuery): Promise<ApiList<Feature>> => {
    const { data } = await apiClient.get<ApiList<Feature>>('/features', { params: query })
    return data
  },
  getById: async (id: string): Promise<Feature> => {
    const { data } = await apiClient.get<ApiSuccess<Feature>>(`/features/${id}`)
    return data.data
  },
  create: async (input: FeatureCreateInput): Promise<Feature> => {
    const { data } = await apiClient.post<ApiSuccess<Feature>>('/features', input)
    return data.data
  },
  update: async (id: string, input: FeatureUpdateInput): Promise<Feature> => {
    const { data } = await apiClient.patch<ApiSuccess<Feature>>(`/features/${id}`, input)
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/features/${id}`)
  },
}
```

### `hooks/useFeature.ts`

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { featureService } from '../services/featureService'
import type { FeatureCreateInput, FeatureUpdateInput, FeatureListQuery } from '../types'

export const featureKeys = {
  all: ['features'] as const,
  list: (query?: FeatureListQuery) => [...featureKeys.all, 'list', query] as const,
  detail: (id: string) => [...featureKeys.all, 'detail', id] as const,
}

export function useFeatures(query?: FeatureListQuery) {
  return useQuery({
    queryKey: featureKeys.list(query),
    queryFn: () => featureService.list(query),
  })
}

export function useFeature(id: string) {
  return useQuery({
    queryKey: featureKeys.detail(id),
    queryFn: () => featureService.getById(id),
    enabled: !!id,
  })
}

export function useCreateFeature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FeatureCreateInput) => featureService.create(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: featureKeys.all })
      toast.success('Tạo thành công')
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Lỗi tạo feature'),
  })
}

export function useUpdateFeature(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FeatureUpdateInput) => featureService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: featureKeys.all })
      qc.invalidateQueries({ queryKey: featureKeys.detail(id) })
      toast.success('Cập nhật thành công')
    },
  })
}

export function useDeleteFeature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => featureService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: featureKeys.all }),
  })
}
```

### `views/FeatureListView.tsx`

```tsx
'use client'
import { useFeatures } from '../hooks/useFeature'
import { FeatureCard } from '../components/FeatureCard'
import { FeatureEmptyState } from '../components/FeatureEmptyState'

export function FeatureListView() {
  const { data, isLoading } = useFeatures()

  if (isLoading) return <FeatureListSkeleton />
  if (!data?.data.length) return <FeatureEmptyState />

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.data.map(f => <FeatureCard key={f.id} feature={f} />)}
    </div>
  )
}

function FeatureListSkeleton() { return <div>Loading...</div> }
```

### Page wiring

```tsx
// app/(dashboard)/features/page.tsx
import { FeatureListView } from '@/features/feature'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Features', path: '/features' })

export default function Page() {
  return <FeatureListView />
}
```

### `components/FeatureForm.tsx` (RHF + zod)

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateFeature } from '../hooks/useFeature'

const schema = z.object({
  name: z.string().min(1, 'Required').max(100),
  description: z.string().max(500).optional(),
})
type FormValues = z.infer<typeof schema>

export function FeatureForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })
  const create = useCreateFeature()

  const onSubmit = form.handleSubmit((values) => create.mutate(values))

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FormField name="name" render={({ field }) => (
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={create.isPending}>Save</Button>
      </form>
    </Form>
  )
}
```

## Anti-patterns

- ❌ Cross-feature import: `features/feature/...` import `features/other/internal/...`
- ❌ `try { await mutation.mutateAsync() } catch { ... }` — dùng `onError` callback
- ❌ Lưu data từ Query sang zustand store (duplicate)
- ❌ Khởi tạo `QueryClient` top-level (SSR cache leak)
- ❌ Default export cho component (chỉ page/layout default export)

## References

- [.claude/rules/frontend-architecture.md](../../rules/frontend-architecture.md)
- [.claude/rules/coding-style.md](../../rules/coding-style.md) — React conventions
- nextjs-boilerplate `src/features/auth/` — reference pattern
