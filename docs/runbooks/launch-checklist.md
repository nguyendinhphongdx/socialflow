---
title: Launch Checklist
description: Tất cả checks phải pass trước khi production go-live (Sociflow v0.1.0)
audience: [founder, ops]
---

# Sociflow Launch Checklist

> Hoàn thành 100% trước khi flip DNS / enable Stripe live mode.
> Reference: [ADR-0008](../decisions/0008-launch-readiness.md), [definition-of-done.md](../definition-of-done.md).

## Pre-launch verification

### Code quality

- [ ] `pnpm type-check` green (12/12 packages)
- [ ] `pnpm lint` clean
- [ ] `pnpm test` pass (target: 80% Service coverage)
- [ ] No `console.log` in source (lint enforced)
- [ ] No `as any` (lint enforced)
- [ ] No `try-catch` bao business logic
- [ ] No `throw new Error('...')` business code
- [ ] File ≤ 400 lines (max 800)
- [ ] Function ≤ 50 lines

### Smoke tests (manual với credentials thật)

- [ ] Phase 1 (YouTube) — [smoke-test-phase1.md](smoke-test-phase1.md)
- [ ] Phase 2 (FB+IG) — [smoke-test-phase2.md](smoke-test-phase2.md)
- [ ] Phase 3 (Calendar+Draft) — [smoke-test-phase3.md](smoke-test-phase3.md)
- [ ] Phase 4 (AI gen) — [smoke-test-phase4.md](smoke-test-phase4.md)
- [ ] Phase 5 (Extension) — [smoke-test-phase5.md](smoke-test-phase5.md)
- [ ] Phase 6 (Engagement+Analytics) — [smoke-test-phase6.md](smoke-test-phase6.md)

### Infrastructure

- [ ] Production VPS provisioned (≥ 4 CPU, 8GB RAM, 100GB disk)
- [ ] DNS A record `sociflow.io` → VPS IP
- [ ] DNS A record `api.sociflow.io` (nếu tách subdomain)
- [ ] DNS CNAME `cdn.sociflow.io` → Cloudflare R2 custom domain
- [ ] SSL cert active via certbot (Let's Encrypt) cho cả 2 hostname
- [ ] SSL auto-renew cron verified: `sudo certbot renew --dry-run`
- [ ] Docker compose prod chạy clean: `docker compose -f docker-compose.prod.yml up -d`
- [ ] Postgres backup chạy daily: verify `infra/scripts/backup-postgres.sh` schedule
- [ ] Backup RESTORE test: xoá DB → restore từ R2 → verify data intact
- [ ] Redis persistence enabled (AOF hoặc RDB snapshot)
- [ ] Sentry capture test error (manual trigger error → check Sentry dashboard)
- [ ] Grafana dashboard live, alert rules configured
- [ ] Nginx rate limit verified với k6 load test (5 r/s auth, 30 r/s api)
- [ ] HTTPS-only redirect (`http://` → 301 → `https://`)

### Security

- [ ] [security.md](../../.claude/rules/security.md) mandatory checks pass
- [ ] All `.env.production` secrets generated random (no defaults from .env.example)
- [ ] `ENCRYPTION_KEY` 32 bytes base64 (`openssl rand -base64 32`)
- [ ] `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` ≥ 32 chars, **khác nhau**
- [ ] `INTERNAL_API_TOKEN` random (api ↔ ai shared)
- [ ] CORS origin whitelist không có `*` — chỉ `sociflow.io` + extension origins
- [ ] Rate limit verified trên auth endpoints (5 req/60s/IP)
- [ ] Webhook signature verify thật (Meta + Stripe + TikTok)
- [ ] HTTPS only (HSTS header `max-age=31536000; includeSubDomains; preload`)
- [ ] Helmet enabled với CSP strict
- [ ] No secret in git history (gitleaks scan)
- [ ] Cookie `httpOnly` + `secure` + `sameSite=Lax`
- [ ] Refresh token rotation single-use verified
- [ ] Soft-delete enforce (deletedAt filter via repo wrapper)
- [ ] R2 bucket policy: chỉ public read prefix `media/` `ai-gen/`, cấm public write
- [ ] Postgres không expose port 5432 ra public network
- [ ] SSH password disabled, key-only

### Business / Compliance

- [ ] Privacy Policy live: `https://sociflow.io/legal/privacy` (F-712)
- [ ] Terms of Service live: `https://sociflow.io/legal/terms` (F-712)
- [ ] Data Deletion endpoint hoạt động: `https://sociflow.io/auth/data-deletion` (F-713)
- [ ] Cookie consent banner (Vietnam ND-13 / GDPR)
- [ ] Meta App Review approved (hoặc test users mode tạm thời) — xem [app-review-submission.md](app-review-submission.md)
- [ ] TikTok For Developers approved (hoặc Extension fallback ready)
- [ ] YouTube Data API quota requested ≥ 100K/day (default 10K)
- [ ] Stripe live mode keys configured + webhook registered
- [ ] Email transactional configured (Resend live API key)
- [ ] Test email reach inbox (not spam): verify-email, publish-failed, password-reset

### Performance

- [ ] Load test 100 concurrent users với k6 — p95 < 500ms
- [ ] Database connection pool sized correctly (Prisma `connectionLimit ≥ 20`)
- [ ] Redis memory < 75% under load
- [ ] Worker BullMQ concurrency tuned (publish: 5, ai: 3, insight: 2)
- [ ] CDN/R2 cache headers set: `Cache-Control: public, max-age=31536000, immutable`
- [ ] Image optimization (sharp) verify EXIF strip + WebP fallback
- [ ] Web bundle size analyzed (`pnpm --filter web analyze`) — first load < 200KB JS

### User-facing

- [ ] Landing page live (`/`) — F-711
- [ ] Pricing page live (`/pricing`) — F-701
- [ ] Onboarding wizard hoạt động (`/onboarding`) — F-702
- [ ] Status page (`/status`)
- [ ] 404 + 500 error page custom
- [ ] Sign up flow E2E (Playwright)
- [ ] First publish flow E2E
- [ ] Mobile responsive verified (Chrome DevTools + thiết bị thật iOS + Android)
- [ ] i18n VN OK (English có thể follow-up sau launch)
- [ ] Browser support tested: Chrome, Edge, Safari, Firefox latest

### Monitoring + alerting

- [ ] Sentry alert email khi error rate spike > 10/min
- [ ] Grafana alert: queue depth > 1000, p95 > 1s, 5xx rate > 1%
- [ ] UptimeRobot ping `/api/v1/health/live` mỗi 5 phút
- [ ] Database disk space alert > 80%
- [ ] Redis memory alert > 80%
- [ ] On-call rotation document (nếu có team)
- [ ] Runbook incident response: `docs/runbooks/incident-response.md` (TODO)

### Rollback plan

- [ ] Database backup snapshot taken trước go-live
- [ ] Git tag `v0.1.0` taken — `git tag v0.1.0 && git push --tags`
- [ ] Docker image tag immutable: `sociflow/api:v0.1.0`, `sociflow/web:v0.1.0`
- [ ] Rollback procedure documented (revert deploy, restore DB)
- [ ] Communication plan nếu cần downtime (email user 24h trước)

## Go-live sequence

1. **T-24h** — Set DNS TTL 60s (giảm cache lag rollback)
2. **T-1h** — Final code freeze + tag `v0.1.0`
3. **T-30m** — Deploy to prod cluster, verify health endpoint
4. **T-15m** — Manual smoke (login + connect 1 account + publish 1 post)
5. **T-0** — Flip DNS (nếu blue-green) hoặc public domain announce
6. **T+15m** — Monitor Sentry + Grafana — verify no spike
7. **T+1h** — Soft-launch: invite 10 beta users qua email
8. **T+24h** — Monitor 24h, gather feedback
9. **T+48h** — Public announce (marketing post, social, ProductHunt nếu plan)

## Post-launch (week 1)

- [ ] Daily check error rate (Sentry)
- [ ] Daily check queue health (BullMQ admin UI)
- [ ] Weekly check OAuth token expiry queue (refresh succeeded ratio)
- [ ] Weekly backup restore drill
- [ ] User feedback channel monitored (email + Discord/community)
- [ ] Hotfix process ready (xem [git-workflow.md](../../.claude/rules/git-workflow.md))

## Post-launch (month 1)

- [ ] Retrospective: roadmap accuracy vs reality
- [ ] User churn analysis
- [ ] Cost analysis (R2 bandwidth, OpenAI usage, VPS resources)
- [ ] Plan Phase 8 (post-MVP) based on user feedback

## References

- [ADR-0008](../decisions/0008-launch-readiness.md) — Launch roadmap 8 tuần
- [definition-of-done.md](../definition-of-done.md) — DoD mức 3 (phase done)
- [10-deployment.md](../10-deployment.md) — Deploy guide chi tiết
- [app-review-submission.md](app-review-submission.md) — Meta + TikTok App Review
- [security.md](../../.claude/rules/security.md) — Security hard rules
- [git-workflow.md](../../.claude/rules/git-workflow.md) — Tag + release strategy
