---
name: sync-docs
description: Đồng bộ docs/ với code thực tế. Quét code → tìm drift với docs → cập nhật. Use periodically hoặc khi nghi ngờ docs stale.
---

# Skill: sync-docs

Audit + sync docs với code thực tế. Tránh docs stale.

## Khi nào chạy

- Định kỳ (cuối mỗi phase)
- Trước launch
- Sau refactor lớn
- User yêu cầu: "check docs", "/sync-docs"

## Workflow

### 1. Identify drift

Quét code + so sánh docs:

| Check | Tool |
|---|---|
| Endpoint trong docs có exist trong code? | `grep "@Post|@Get|..." apps/api/src/` |
| Prisma model trong docs đúng schema.prisma? | Read schema + diff với `docs/03-data-model.md` |
| Platform list trong docs khớp `AccountPlatform` enum? | Compare enum vs `docs/platforms/` files |
| ResponseCode trong docs vs code? | Compare `response-code.ts` vs `docs/08-api-conventions.md` |
| Feature ID trong roadmap vs code commits? | Grep commit messages cho `F-XXX` |
| Library version trong tech-stack vs `package.json`? | Compare deps |

### 2. Report drift

```markdown
# Docs drift report — YYYY-MM-DD

## Endpoint missing in docs
- `POST /api/v1/notifications/mark-read` (code) — chưa có trong docs

## Endpoint in docs but removed from code
- `POST /api/v1/legacy-publish` (docs) — code đã xoá

## Schema drift
- `User.referralCode` (docs) — code không có
- `Account.lastErrorAt` (code) — docs chưa update

## Stale tech version
- `prisma: ^4.0.0` (docs) → actual `^5.0.0`

## Missing ADR
- Code thay đổi (vd: switch sang Drizzle?) chưa có ADR

## INDEX.md inconsistencies
- `docs/platforms/threads.md` không có trong INDEX
```

### 3. Decide action

User quyết per-finding:
- **Update docs** → match code (default)
- **Revert code** → match docs (rare, chỉ khi docs là source of truth)
- **Tạo ADR** → nếu là quyết định lớn không document
- **Ignore** → docs cố tình không cover (chú thích lý do)

### 4. Apply updates

Edit file tương ứng. Cập nhật `last_updated` frontmatter.

### 5. Update INDEX.md

Sync lại `docs/INDEX.md`:
- Add file mới
- Remove file đã xoá
- Cập nhật mapping intent → docs

## Specific checks

### API endpoint sync

```bash
# List all endpoints in code
grep -r "@\(Post\|Get\|Patch\|Delete\)\b" apps/api/src/ --include="*.ts" \
  | sed 's/.*@\(Post\|Get\|Patch\|Delete\)(\(.[^)]*\)).*/\1 \2/' \
  | sort -u
```

So sánh với endpoints mention trong `docs/04-publish-flow.md`, `docs/07-engagement.md`, `docs/08-api-conventions.md`.

### Prisma model sync

```bash
# Đếm model trong schema
grep -c "^model " packages/prisma/schema.prisma
```

So sánh với số model document trong `docs/03-data-model.md`. Mỗi model phải có section.

### Platform enum sync

```bash
grep -A 20 "enum AccountPlatform" packages/prisma/schema.prisma
ls docs/platforms/*.md
```

1-1 mapping bắt buộc.

### ResponseCode sync

```bash
grep "^\s*\w* = " packages/common/src/response-code.ts | wc -l
```

Đếm code trong `docs/08-api-conventions.md` "Response code" section.

### Feature ID sync

```bash
# In docs
grep "F-[0-9]\{3\}" docs/01-features.md | sort -u

# In commits / code (ID có thể trong PR description, không guarantee)
git log --grep="F-[0-9]\{3\}" --pretty=format:"%s"
```

Mark feature `[x]` shipped khi tìm thấy commit/PR matching.

## Common drift causes

| Cause | Detection |
|---|---|
| Quick fix không update docs | Commit `fix:` mà touch schema/endpoint |
| Refactor không sync | Branch dài, doc skim qua |
| ADR chưa được tạo | Quyết định lớn discuss qua chat, code merge |
| Roadmap phase trượt | Feature shipped khác plan |
| Stale code example | API signature đổi nhưng docs giữ |

## Auto-detection (future)

Phase 7+ có thể setup CI job:

```yaml
- name: Docs drift check
  run: pnpm sync-docs:check
  # Exit non-zero nếu drift detected, list trong PR comment
```

Tool ý tưởng:
- `tsdoc-extractor` parse JSDoc + compare docs
- Markdown link checker (catch broken cross-link)
- ResponseCode sync script

## Output template

Khi chạy skill xong, present user:

```markdown
# Docs sync report

## Auto-fixed
- ✅ Added 3 new endpoint to docs/08-api-conventions.md
- ✅ Updated AccountPlatform enum docs to match code
- ✅ Bumped prisma version in docs/09-tech-stack.md

## Needs your decision
1. `referralCode` field — code không có, docs đề cập. Remove from docs?
   → Yes/No

2. ResponseCode `FeatureLimitReached` chưa có message mapping
   → Add default message?

## Untracked
- File `apps/api/src/core/legacy/...` không clear thuộc module nào
  → Cleanup hoặc document?
```
