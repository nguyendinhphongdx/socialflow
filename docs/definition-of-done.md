---
title: Definition of Done
description: Tiêu chí formal cho "feature done end-to-end" — gồm code, test, docs, security, observability
audience: [pm, developer, ai-agent]
last_updated: 2026-05-16
---

# Definition of Done

> **Mục đích**: Định nghĩa **một nguồn duy nhất** cho việc khi nào một feature, một commit, hoặc một phase được coi là "done". Tránh tình trạng đánh ✅ trong [PROGRESS.md](../PROGRESS.md) chỉ vì "compile pass" hoặc "happy path chạy local".

## 3 mức "done"

Sociflow phân biệt 3 mức done, mỗi mức bao trùm mức trước:

```
┌──────────────────────────────────────────┐
│  3. Phase done                           │
│     (toàn bộ F-XXX trong phase → done)  │
│  ┌────────────────────────────────────┐  │
│  │  2. Feature done (per F-XXX)       │  │
│  │     code + test + docs + security  │  │
│  │     + observability + smoke real   │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │  1. Code done (per commit)   │  │  │
│  │  │     type + lint + test pass  │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## Mức 1 — Code done (per commit)

Mỗi commit đẩy lên branch phải pass. Áp dụng tự động qua pre-commit hook + CI.

Tham chiếu: [CLAUDE.md](../CLAUDE.md) "Conventions checklist" + [.claude/rules/project-standards.md](../.claude/rules/project-standards.md) "Build verification".

Checklist:

- [ ] `pnpm type-check` pass (`tsc --noEmit`)
- [ ] `pnpm lint` pass (ESLint flat config)
- [ ] `pnpm test` pass cho file liên quan
- [ ] Không `console.log` (dùng `Logger` instance)
- [ ] Không `as any`, không `@ts-ignore`
- [ ] Không `try-catch` bao business logic
- [ ] Không `throw new Error(...)` business code → dùng `AppException`
- [ ] File ≤ 400 dòng (max 800), function ≤ 50 dòng
- [ ] Conventional commit message (`feat:`, `fix:`, `refactor:`...)

CI gate: PR đỏ ⇒ không merge.

---

## Mức 2 — Feature done (per F-XXX)

Mỗi feature `F-XXX` ở [01-features.md](01-features.md) chỉ được đánh ✅ trong [PROGRESS.md](../PROGRESS.md) khi pass toàn bộ block dưới.

### Checklist feature

- [ ] **Code**: Implementation pass mức 1, đáp ứng AC ghi ở [01-features.md](01-features.md), tuân thủ layering Controller → Service → Repository.
- [ ] **Test**:
  - Unit test Service ≥ 80% coverage (theo [.claude/rules/testing.md](../.claude/rules/testing.md))
  - Integration test cho endpoint chính (supertest + test DB)
  - Error path có test riêng (xem [.claude/rules/error-handling.md](../.claude/rules/error-handling.md) "Testing error path")
- [ ] **Docs**:
  - Cập nhật `docs/<area>.md` liên quan (data model, publish flow, platform spec...)
  - Tạo ADR nếu là quyết định architecture (xem [decisions/_template.md](decisions/_template.md))
  - Cập nhật [INDEX.md](INDEX.md) nếu thêm doc mới
- [ ] **Security** (xem [.claude/rules/security.md](../.claude/rules/security.md) "Mandatory checks"):
  - Input validate qua zod DTO `.strict()`
  - Permission filter ở Service layer (query condition, không check sau load)
  - Secret encrypted at rest (token, refresh token)
  - Không leak sensitive data trong log / error message
- [ ] **API** (nếu là endpoint mới, xem [.claude/rules/api-design.md](../.claude/rules/api-design.md) "Mandatory checklist"):
  - DTO + VO sinh từ zod schema qua `createZodDto`
  - `@ApiTags` + `@ApiDoc` đầy đủ
  - HTTP verb đúng, path kebab-case
- [ ] **Observability**:
  - Log success + fail path qua `Logger` instance
  - Sentry capture cho unexpected error
  - Metric cho long-running operation (queue depth, latency)
- [ ] **Manual smoke test**:
  - Test với **credentials thật** của platform (OAuth thật, API key thật) — không phải mock
  - Document kết quả vào `docs/runbooks/smoke-test-<phase>.md` (mẫu: [runbooks/smoke-test-phase1.md](runbooks/smoke-test-phase1.md))

### Template feature DoD

Copy block dưới vào PR description hoặc ADR khi ship `F-XXX`:

```markdown
### F-XXX <feature name>

- [ ] Code: implementation pass type-check + lint + AC
- [ ] Test: unit ≥80% service, integration cho endpoint chính, error path covered
- [ ] Docs: <list file cập nhật>
- [ ] Security: input validate, permission filter, secret encrypt, log redact
- [ ] API: DTO/VO/ApiDoc đầy đủ (nếu có endpoint)
- [ ] Observability: log + sentry + metric
- [ ] Manual smoke: <provider + credentials + kết quả>
```

---

## Mức 3 — Phase done (per Phase 0-7)

Một phase trong [11-roadmap.md](11-roadmap.md) chỉ được đánh ✅ trong [PROGRESS.md](../PROGRESS.md) "Quick status" khi:

- [ ] Tất cả feature `F-XXX` thuộc phase đạt **mức 2** (feature done)
- [ ] Toàn bộ task trong cột DoD của phase (xem [11-roadmap.md](11-roadmap.md)) đã tick
- [ ] Phase smoke test runbook tồn tại tại `docs/runbooks/smoke-test-phase<N>.md`
- [ ] "Known issues" cho phase đó đã được resolve hoặc downgrade severity (xem `PROGRESS.md` table)
- [ ] Demo milestone của phase (nếu có) đã verify

### Phân biệt "✅ scaffold" vs "✅ phase done"

Hiện `PROGRESS.md` có dùng `✅ scaffold` (vd Phase 5, Phase 6) — nghĩa là code path sạch, build pass, nhưng **chưa pass mức 2 manual smoke**. Đây là trạng thái trung gian.

| Marker | Ý nghĩa | Mức tương ứng |
|---|---|---|
| `✅` | Phase done — pass tất cả mức 2 + smoke real | Mức 3 |
| `✅ scaffold` | Code viết xong, build pass, chưa smoke real | Mức 1 + một phần mức 2 |
| `🟡` | Partial — một số feature done, còn pending | Mix |
| `⏳` | Pending — chưa start | - |
| `❌` | Blocked — có dependency external chưa resolve | - |

---

## Mapping với rules

| Mức | Reference chính |
|---|---|
| Code done | [CLAUDE.md](../CLAUDE.md) "Conventions checklist" + [.claude/rules/project-standards.md](../.claude/rules/project-standards.md) "Build verification" |
| Test done | [.claude/rules/testing.md](../.claude/rules/testing.md) "Minimum coverage" |
| Security done | [.claude/rules/security.md](../.claude/rules/security.md) "Mandatory checks trước mỗi commit" |
| API done | [.claude/rules/api-design.md](../.claude/rules/api-design.md) "Mandatory checklist" |
| Error handling | [.claude/rules/error-handling.md](../.claude/rules/error-handling.md) |
| Feature AC | [01-features.md](01-features.md) cột AC |
| Phase DoD | [11-roadmap.md](11-roadmap.md) cột DoD |

---

## Anti-patterns

- ❌ Đánh ✅ trong PROGRESS.md chỉ vì `pnpm build` pass
- ❌ Skip test với lý do "sẽ viết sau" — TDD bắt buộc cho service/business logic
- ❌ Manual smoke bằng mock data hoặc fixture, không phải credentials thật của provider
- ❌ Tick "Docs" mà không update [INDEX.md](INDEX.md) khi thêm file mới
- ❌ Ship feature thêm endpoint mà thiếu `@ApiDoc` / `@ApiTags`
- ❌ Đẩy lên prod khi chưa pass security checklist (đặc biệt: input validate, secret encrypt, permission filter)
- ❌ Đánh ✅ phase khi runbook smoke-test chưa tồn tại
- ❌ Coverage drop > 2% mà vẫn merge (CI gate enforce)

---

## Khi không chắc

- Feature có pass mức 2 chưa? → Đi qua từng checkbox; nếu không tự trả lời được câu nào → chưa done.
- Có cần ADR không? → Có nếu là quyết định architecture / chọn lib / thay đổi pattern. Xem [decisions/_template.md](decisions/_template.md).
- Có cần smoke test thật không? → Có cho mọi feature đụng provider external (OAuth, AI provider, platform API, payment).

## References

- [PROGRESS.md](../PROGRESS.md) — tracking thực tế
- [01-features.md](01-features.md) — AC mỗi feature
- [11-roadmap.md](11-roadmap.md) — DoD mỗi task theo tuần
- [runbooks/smoke-test-phase1.md](runbooks/smoke-test-phase1.md) — mẫu smoke test runbook
