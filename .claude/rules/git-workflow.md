---
title: Git workflow (HARD)
audience: ai-agent
---

# Git workflow

## Branch naming

Format: `<type>/<short-desc>`

| Type | Khi nào |
|---|---|
| `feat/` | Tính năng mới |
| `fix/` | Bug fix |
| `refactor/` | Refactor không đổi behavior |
| `docs/` | Sửa docs |
| `test/` | Thêm/sửa test |
| `chore/` | Setup tools, CI, deps update |
| `perf/` | Performance |
| `ci/` | CI/CD config |

Examples:
- `feat/youtube-oauth`
- `fix/publish-token-refresh`
- `refactor/extract-publish-dispatcher`
- `docs/update-readme`

Branch từ `main`. Single-purpose, max ~500 line diff.

## Commit message

Format:
```
<type>: <description>

<optional body>
```

`<type>` giống branch type. Description: imperative, lowercase, không period cuối.

✅ Examples:
```
feat: add youtube oauth callback
fix: handle expired token in publish provider
refactor: extract media staging service
docs: add ADR for extension architecture
test: cover publish failure paths
```

❌ Bad:
```
Added stuff
fix bug
feat: Updated the user authentication module to support OAuth 2.0 with PKCE flow and refresh token rotation
WIP
```

Length: ≤72 chars header. Body cho context (WHY), không repeat WHAT.

## Conventional commits enforcement

Pre-commit hook qua `commitlint`:

```js
// commitlint.config.cjs
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci', 'style']],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 72],
  },
}
```

## Pre-commit hook

```js
// simple-git-hooks config in package.json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged",
    "commit-msg": "pnpm commitlint --edit $1"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": "eslint --fix",
    "*.{json,md,yml}": "prettier --write"
  }
}
```

Pre-commit chạy `lint-staged` (chỉ file changed) — fast.

Pre-push hook (optional): chạy `pnpm type-check` (toàn project).

## PR workflow

### Before push

1. Rebase `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Clean commits (squash WIP):
   ```bash
   git rebase -i HEAD~N
   ```
3. Test pass:
   ```bash
   pnpm type-check
   pnpm lint
   pnpm test
   ```

### Push + PR

```bash
git push -u origin feat/youtube-oauth
gh pr create --title "feat: add youtube oauth callback" --body "..."
```

PR body template (`.github/pull_request_template.md`):

```markdown
## Summary
- 1-3 bullet WHAT change
- Link issue: closes #N

## Context
WHY change (constraint, decision, user need)

## Test plan
- [ ] Unit test added for X
- [ ] Integration test for Y endpoint
- [ ] Manual test: ... (steps)

## Screenshots / Demo
(if UI change)

## Checklist
- [ ] Type-check pass
- [ ] Lint pass
- [ ] Tests pass
- [ ] Docs updated (if behavior change)
- [ ] ADR added (if architectural decision)
```

### Review

- Self-review diff trước khi request review
- Tag reviewer hoặc owner
- Comment giải thích chỗ tricky inline
- Reply mọi review comment trước khi merge

## Merge strategy

**Squash + merge** (default). Single commit per PR vào `main`.

KHÔNG:
- Merge commit (làm history phức tạp)
- Rebase + fast-forward (mất context PR)

Sau merge:
```bash
git branch -d feat/youtube-oauth
git push origin :feat/youtube-oauth
```

## Protected branch

`main`:
- Required: PR + 1 approval (nếu có collaborator)
- Required: CI checks pass (lint + type + test + build)
- Required: linear history
- Force push: BLOCK
- Delete: BLOCK

## Hotfix

Nếu prod bug critical:

1. Branch từ `main` (tag latest production):
   ```bash
   git checkout -b fix/critical-prod-bug origin/main
   ```
2. Fix + test + PR
3. Merge → deploy
4. Backport sang feature branch đang dev

## Tag & release

Mỗi production deploy:
```bash
git tag v0.1.0
git push --tags
```

Semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: breaking API
- MINOR: feature mới
- PATCH: fix

GitHub Releases: changelog auto từ conventional commit (`release-please` hoặc `changesets`).

## .gitignore essentials

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build
dist/
build/
.next/
.turbo/
.vercel/

# Env
.env
.env.*
!.env.example

# Editor
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Test
coverage/
playwright-report/
test-results/

# Logs
*.log
logs/

# Prisma
*.db
prisma/migrations/dev/

# Extension build
apps/extension/dist/
apps/extension/*.zip
```

## Co-author / attribution

Disable Co-Authored-By tự động (theo preference solo).

KHÔNG ghi:
- `Co-Authored-By: Claude <noreply@anthropic.com>`
- `🤖 Generated with Claude Code`

## Sensitive file handling

Nếu trót commit secret:

1. **DO NOT** `git push --force` để xoá history nếu đã share remote
2. Rotate secret ngay
3. Add file vào `.gitignore`
4. Commit fix
5. (Optional, cẩn thận) `git filter-repo` clean history rồi báo cộng tác viên

Tools:
- `gitleaks` pre-commit scan
- `git-secrets` AWS-specific

## Commit size

- Atomic — 1 logical change per commit
- ≤ 500 dòng diff khuyến nghị
- Split nếu lớn:
  - Refactor riêng (prep)
  - Feature riêng
  - Test riêng

## Stash discipline

`git stash` chỉ tạm thời. Nếu lưu > 1 ngày → tạo branch:

```bash
git stash branch feat/wip-something
```

## Submodule

KHÔNG dùng git submodule. Dùng pnpm workspace + package version pin thay vì.

## Git LFS

Cho file > 10 MB:
- Asset design (Figma export)
- Test fixtures lớn

Không dùng cho:
- Source code
- Generated build output (đã có `.gitignore`)

## Long-running fork (nếu có)

Nếu fork upstream repo (vd templates):
- Sync `upstream/main` định kỳ
- Document divergence ở `docs/upstream-fork.md`
