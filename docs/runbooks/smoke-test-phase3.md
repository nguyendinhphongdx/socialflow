---
title: Smoke test — Phase 3 (Calendar + Draft + Scheduled publish)
description: Verify luồng draft CRUD + scheduled publish + calendar reschedule
audience: [developer]
---

# Smoke test — Phase 3 (UI complete)

Verify: draft tạo/sửa/xoá, scheduled publish (PENDING → DISPATCHED → PUBLISHED), calendar drag-drop reschedule, duplicate draft.

## Pre-requisites

1. Đã pass [smoke-test-phase1.md](smoke-test-phase1.md) và có ít nhất 1 social account ACTIVE (YouTube hoặc Facebook).
2. `pnpm dev` running.
3. User logged in.
4. (Optional) 1 ảnh đã upload sẵn trong Media Library.

## Steps

### 1. Tạo draft

Web: <http://localhost:3020/dashboard/drafts/new>:
- Title: `Draft smoke test`
- Body (TipTap rich text): bold + italic + 1 link
- Tags chip: `smoke`, `phase3`
- Select 1 account (YouTube)
- Click **Save draft** (KHÔNG publish)

Verify URL redirect: `/dashboard/drafts/<id>/edit` hoặc `/dashboard/drafts`.

Verify DB:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, title, status, tags, \"accountIds\"
FROM \"Draft\" ORDER BY \"createdAt\" DESC LIMIT 5;
"
```
- `status = 'DRAFT'`
- `tags` = `['smoke', 'phase3']`
- `accountIds` JSON array.

### 2. Edit draft

Web: <http://localhost:3020/dashboard/drafts> → click row → edit:
- Đổi title → `Draft updated`
- Thêm body line
- Save

Verify `updatedAt` đổi:
```sql
SELECT title, "updatedAt" FROM "Draft" WHERE id = '<id>';
```

### 3. Convert draft → scheduled

Web: <http://localhost:3020/dashboard/drafts/[id]/publish>:
- Chọn time: **5 phút sau** (datetime-local)
- Verify account đã pre-select từ draft
- Click **Schedule**

Verify response:
- Redirect `/dashboard/publish`
- Record xuất hiện status `SCHEDULED`
- Draft `status = 'PUBLISHED'` (đã convert)

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT pr.id, pr.status, pr.\"publishAt\", d.title
FROM \"PublishRecord\" pr
LEFT JOIN \"Draft\" d ON d.id = pr.\"sourceDraftId\"
ORDER BY pr.\"createdAt\" DESC LIMIT 3;
"
```

### 4. Wait → verify status transition

Vẫn ở `/dashboard/publish` (auto-refresh 5s) → wait ~5 phút.

Status transition expected:
- `SCHEDULED` (lúc delayed job chưa fire)
- `PENDING` (job fire, enqueue main queue)
- `DISPATCHED` (consumer pick up)
- `IN_PROGRESS` (đang gọi provider)
- `PUBLISHED` (provider trả `workLink`)

Click `workLink` → verify post lên platform.

### 5. Drag-drop reschedule trên Calendar

Web: <http://localhost:3020/dashboard/calendar>:
- View Month
- Tạo 1 scheduled publish khác (cùng pattern step 3, schedule 1 ngày sau)
- Sau khi hiện trên calendar → drag event sang day khác
- FullCalendar fire `eventDrop` → call `PATCH /publish/:id/reschedule` với new `publishAt`

Verify:
```sql
SELECT id, "publishAt" FROM "PublishRecord" WHERE id = '<id>';
```
`publishAt` đã thay đổi.

> ⚠️ Hiện tại `editable: true` đã set nhưng handler `eventDrop` có thể chưa wire — kiểm tra `CalendarView.tsx`. Nếu chưa: ghi vào [PROGRESS.md](../../PROGRESS.md) "Calendar drag-drop pending".

### 6. Duplicate draft

Drafts list → kebab menu trên row → **Duplicate**.

Verify:
- Draft mới copy title `<original> (copy)`, body, tags, accountIds
- `status = 'DRAFT'`
- `id` mới

### 7. Delete draft

Drafts list → kebab menu → **Delete** → confirm.

Verify soft-delete:
```sql
SELECT id, "deletedAt" FROM "Draft" WHERE id = '<id>';
```
`deletedAt` không null. Repository filter `deletedAt: null` → list view không hiển thị.

### 8. Cancel scheduled publish

Publish list → scheduled record → **Cancel**.

Verify:
- `status = 'CANCELLED'`
- BullMQ delayed job removed
- Draft (nếu link) vẫn intact (không revert status)

## Cleanup

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
TRUNCATE \"Draft\", \"PublishRecord\", \"PublishBundle\" CASCADE;
"
docker exec -it sociflow-redis redis-cli FLUSHDB
```

## Known issues

### Scheduled job không fire sau 5 phút
- Kiểm tra Redis up: `docker ps | grep redis`
- Kiểm tra `delay` value: `redis-cli ZRANGE bull:publish-scheduled:delayed 0 -1 WITHSCORES` — score là epoch ms.
- Server clock drift? Sync NTP host.

### Calendar không hiện event
- FullCalendar fetch từ `GET /publish?from=<start>&to=<end>` — verify endpoint trả đúng range.
- `publishAt` null hay future → ok. `null` (instant) thì không hiện trên calendar.

### TipTap content không save
- `JSON.stringify` content tree → field `body` schema phải là `Text` (string) hoặc `Json`.
- Trống `<p></p>` cũng được coi là content — verify zod `min(1)` không reject.

### Draft delete bị foreign key constraint
- Nếu draft đã convert sang PublishRecord → soft-delete only, KHÔNG hard-delete.
- Cron `cleanup-soft-deleted` (xem [cli-commands.md](../../.claude/rules/cli-commands.md)) xoá thật sau 30 ngày.

## Next

→ [smoke-test-phase4.md](smoke-test-phase4.md) — AI gen + credits
