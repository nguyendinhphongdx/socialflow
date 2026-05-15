---
title: Coding style (HARD)
audience: ai-agent
---

# Coding style

## File organization

**Many small files > few large files**:
- 200-400 dòng typical
- 800 max
- Tách utils ra file riêng khi reuse
- Tách component lớn ra subcomponent + co-locate

Organize **by feature/domain**, not by type:

```
✅ Đúng
core/publish/
├── publish.controller.ts
├── publish.service.ts
└── providers/
    └── youtube.provider.ts

❌ Sai
controllers/
├── publish.controller.ts
services/
├── publish.service.ts
providers/
├── youtube.provider.ts
```

## Comments

Default: **không viết comment**.

Chỉ viết khi:
- WHY non-obvious (constraint ẩn, invariant subtle)
- Workaround cho bug cụ thể (link issue)
- Behavior gây surprise reader

KHÔNG viết:
- Explain WHAT code làm (đặt tên biến đủ rõ)
- Reference task/PR/issue ("added for #123")
- "TODO" mà không có owner + ngày

```ts
// ❌ Bad
// Loop through users
for (const user of users) { ... }

// ❌ Bad
// Added for feature #234 to support new flow
function adaptContent() { ... }

// ✅ Good
// Meta Graph API trả 'OAuthException' khi token expired
// nhưng cũng dùng cùng error code cho rate limit.
// Phân biệt qua sub-error-code (code 190 = expired).
if (err.code === 190) { ... }
```

## Naming

| Element | Rule | Example |
|---|---|---|
| Boolean | `is/has/should/can` prefix | `isActive`, `hasPermission`, `shouldRetry` |
| Function | verb đầu | `getUser`, `validatePayload`, `parseUrl` |
| Async function | (không cần `Async` suffix) | `fetchData()` (return Promise rõ) |
| Class | noun | `UserService`, `PublishDispatcher` |
| Type/Interface | (không `I` prefix) | `User`, `UserCreateDto` |
| Enum | singular noun | `PublishStatus`, không `PublishStatuses` |
| Generic | `T`, `K`, `V` cho generic, ngữ nghĩa cho specific (`TUser`) | - |
| File | `kebab-case` | `publish-record.service.ts` |

## Function

- Single responsibility
- Max 3 params → quá 3 → object destructure
- Đầu hàm: validate, lấy data, guard clause
- Cuối hàm: return rõ ràng

```ts
// ❌ Bad
async function doStuff(userId: string, x: string, y: number, z: boolean, w?: Date) { ... }

// ✅ Good
async function createPost({ userId, content, accountId, schedule }: CreatePostParams) { ... }
```

### Guard clause

```ts
// ❌ Nested
async function getUser(id) {
  if (id) {
    const user = await this.repo.getById(id)
    if (user) {
      if (!user.deletedAt) {
        return user
      }
    }
  }
  throw new Error('not found')
}

// ✅ Flat
async function getUser(id: string) {
  if (!id) throw new AppException(ResponseCode.ValidationFailed)
  const user = await this.repo.getById(id)
  if (!user || user.deletedAt) throw new AppException(ResponseCode.UserNotFound)
  return user
}
```

## Imports

Order (auto-fix qua eslint):

1. Node built-in (`node:fs`, `node:path`)
2. External package (`@nestjs/common`, `lodash`)
3. Internal alias (`@/...`, `@sociflow/...`)
4. Relative (`./*`, `../*`)
5. Style imports

```ts
import path from 'node:path'

import { Injectable } from '@nestjs/common'
import { z } from 'zod'

import { config } from '@/config'
import { UserService } from '@sociflow/auth'

import { UserDto } from './user.dto'
```

## Conditional & loops

- Cấm `for (let i = 0; ...)` → dùng `for...of` hoặc `map/filter/reduce`
- Cấm `forEach` với async (silent skip await) → dùng `for...of`
- Cấm `while(true)` không có break condition clear
- Cấm switch fall-through implicit (eslint enforce)
- `if-else` nesting max 3 levels — quá → tách function

## Booleans & equality

- `===` / `!==` only (cấm `==`)
- Cấm so sánh `boolean === true` → dùng `if (cond)`
- Object/array equality: dùng `lodash.isEqual` hoặc deep compare lib

## Null vs undefined

- API contract: `null` cho "đã biết là không có" (DB column null)
- `undefined` cho "không truyền" (optional param)
- VO field: dùng `null` cho missing data (consistency với JSON)
- `??` (nullish coalescing) > `||` cho default value

```ts
// ❌
const name = user.name || 'Anonymous'   // empty string → 'Anonymous'

// ✅
const name = user.name ?? 'Anonymous'
```

## Types vs interfaces

| Use | Choice |
|---|---|
| Object shape simple | `type` |
| Extensible / open contract | `interface` |
| Union / intersection | `type` |
| Class shape | `interface` |
| Generic complex | `type` |

```ts
// API contract
export interface PublishProvider {
  publish(record: PublishRecord): Promise<PublishResult>
}

// Discriminated union
export type Event =
  | { type: 'publish.success', record: PublishRecord }
  | { type: 'publish.failed', record: PublishRecord, error: string }
```

## Error messages

- Tiếng Việt cho user-facing message (qua `ResponseMessage` mapping)
- Tiếng Anh cho dev-facing log + internal exception message
- KHÔNG dùng template string lộ sensitive data: `\`User ${user.email} failed login\`` ❌

## Test-friendly code

- Cấm `Date.now()` / `new Date()` rải rác → dùng inject `ClockService` (mockable)
- Cấm `Math.random()` business logic → inject `RandomService`
- Cấm `setTimeout` business logic → dùng BullMQ delayed job
- DI mọi service vào constructor → mock được trong test

## React / Next.js

### Component file

```tsx
// components/PostCard.tsx
import { type FC } from 'react'

interface PostCardProps {
  post: Post
  onSelect?: (id: string) => void
}

export const PostCard: FC<PostCardProps> = ({ post, onSelect }) => {
  return <div>...</div>
}
```

- Named export cho component
- Default export chỉ cho Next.js page/layout
- Props interface ngay trên component
- Cấm `React.FC` từ React 19, dùng explicit `FC` từ `react` import

### Hooks

- Custom hook tên `useXxx`
- Hook order ổn định, không conditional
- `useEffect` cleanup ALWAYS (eslint enforce)
- Cấm `useEffect` để derive state — dùng compute trong render

### State (server vs UI — clear separation)

| Loại state | Lưu ở | Ví dụ |
|---|---|---|
| **Server state** (data từ API) | TanStack Query cache | User profile, post list, account list, auth `useAuth().user` |
| **Cross-component UI state** | zustand store | Compose draft, sidebar collapsed, modal open, agent pairing status |
| **Local UI state** | `useState` / `useReducer` | Form field, hover, accordion expanded |
| **Server-derived computed** | `useMemo` từ Query data | Filter, sort, group |

Quy tắc:
- **Server state → KHÔNG bao giờ duplicate vào zustand**. Auth user lấy từ `useAuth()` (Query), không sync sang store.
- zustand chỉ dùng cho state **không có server source of truth** (compose draft chưa save, sidebar UI).
- Cấm `Context` cho frequent-update state — re-render bão.
- Cấm `useEffect` để derive state từ props/query → dùng `useMemo`.

### Form pattern (RHF + zod + shadcn)

Schema **local file**, không export ra ngoài (tránh coupling với DTO backend):

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 chars'),
})
type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const login = useLogin()    // TanStack mutation

  const onSubmit = form.handleSubmit((data) => {
    login.mutate(data, {
      onSuccess: () => toast.success('Logged in'),
      onError: (err) => toast.error(err.message),
    })
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FormField name="email" render={({ field }) => (
          <FormItem><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        ...
        <Button type="submit" disabled={login.isPending}>Login</Button>
      </form>
    </Form>
  )
}
```

Cấm:
- ❌ `try { await login.mutateAsync(data) } catch (err) { toast.error(...) }` — dùng `onSuccess/onError` callback của `.mutate()`. (TanStack Query đã handle error qua state, không cần try-catch.)
- ❌ Export schema để reuse — DTO backend có thể divergent, FE schema riêng (validate đúng UX cần).
- ❌ Re-validate sau submit success — Query cache đã update, không cần manual refetch.

### Server component vs Client component

- Tailwind utility-first
- shadcn `cn()` helper merge classes
- Cấm inline `style={{}}` trừ khi dynamic value
- Cấm hardcode color (`#000`, `text-black`) → dùng theme variable
- Mobile-first: viết `class` → `md:class` → `lg:class`

### Server component vs Client component

- Default: server component
- `'use client'` chỉ khi cần: `useState`, `useEffect`, event handler, browser API
- Đặt `'use client'` ở component leaf nhất — KHÔNG mark cả page tree

### Provider tree (apps/web)

Top-level provider order quan trọng. Sai → SSR cache leak hoặc theme flash:

```tsx
// app/providers.tsx
'use client'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  // ⚠️ KHÔNG khởi tạo QueryClient ở top-level module — sẽ share cache giữa request SSR
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange>
        <TooltipProvider>
          {children}
          <Toaster richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

Quy tắc:
- ✅ `QueryClient` qua `useState(() => new QueryClient(...))` — instance per-request, không SSR leak.
- ✅ `ThemeProvider` từ `next-themes` với `attribute="class"` + `disableTransitionOnChange` (chống nháy khi đổi theme).
- ❌ KHÔNG khởi tạo `const queryClient = new QueryClient()` ở module top-level — cache share giữa user trên SSR (data leak nghiêm trọng).
- ❌ KHÔNG bọc cả `<html>` trong `'use client'` — đặt providers ở `app/layout.tsx` qua `<Providers>{children}</Providers>`.

## Browser extension

### MV3 quirks

- Service worker có thể bị kill → state tạm dùng `chrome.storage.session`
- Cấm `setInterval` trong service worker (bị suspended) → dùng `chrome.alarms`
- Long task → tạo offscreen document
- Cấm `eval()`, `new Function()` (CSP)
- KHÔNG bundle 3rd-party CDN script

### Content script

- KHÔNG modify global `window` của user
- Inject script qua `chrome.scripting.executeScript` thay vì `<script>` inject
- Cleanup khi page navigate

## SCSS / CSS modules

Sociflow ưu tiên Tailwind. Nếu phải dùng CSS module:

```scss
// PostCard.module.scss
.card {
  padding: 1rem;

  &__title { font-weight: bold; }
  &__title--highlighted { color: blue; }
}
```

BEM-ish: `.block__element--modifier`.

## Bash/shell trong code

Cấm shell injection. Mọi exec phải:
- `execFile` thay vì `exec`
- Whitelist arg
- KHÔNG `shell: true`

```ts
// ❌
exec(`ffmpeg -i ${userInput}`)

// ✅
execFile('ffmpeg', ['-i', sanitizedPath])
```
