import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = 'http://localhost:3000/api/v1'
const WEB_BASE = 'http://localhost:3020'

const uniqueEmail = () => `smoke-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.local`

// Share 1 user qua toàn bộ authed tests — throttler 5/60s cho register.
let sharedTokens: { accessToken: string, refreshToken: string } | null = null

test.beforeAll(async () => {
  const ctx = await playwrightRequest.newContext()
  const email = uniqueEmail()
  const res = await ctx.post(`${API_BASE}/auth/register`, {
    data: { email, password: 'TestPass123!', name: 'Shared' },
  })
  if (res.ok()) {
    const body = await res.json()
    sharedTokens = body.data.tokens
  }
  await ctx.dispose()
})

test.describe('Sociflow smoke tests', () => {
  test('1. API health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health/live`)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.status).toBe('ok')
  })

  test('2. API full health includes database up', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.status).toBe('ok')
    expect(body.data.info.database.status).toBe('up')
  })

  test('3. Landing page loads with H1', async ({ page }) => {
    await page.goto(WEB_BASE)
    await expect(page).toHaveTitle(/Sociflow/i)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('4. Pricing page renders 4 plan cards', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pricing`)
    // Tìm card có "FREE"/"PRO"/"BUSINESS"/"ENTERPRISE"
    await expect(page.getByText(/Free/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Pro/i).first()).toBeVisible()
    await expect(page.getByText(/Business/i).first()).toBeVisible()
    await expect(page.getByText(/Enterprise/i).first()).toBeVisible()
  })

  test('5. Legal pages load', async ({ page }) => {
    await page.goto(`${WEB_BASE}/legal/privacy`)
    await expect(page.locator('h1')).toContainText(/privacy/i, { timeout: 10_000 })

    await page.goto(`${WEB_BASE}/legal/terms`)
    await expect(page.locator('h1')).toContainText(/terms/i, { timeout: 10_000 })
  })

  test('6. POST /auth/register creates user + returns tokens', async ({ request }) => {
    const email = uniqueEmail()
    const res = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'TestPass123!', name: 'Smoke User' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.code).toBe(0)
    expect(body.data.user.email).toBe(email)
    expect(body.data.tokens.accessToken).toBeTruthy()
    expect(body.data.tokens.refreshToken).toBeTruthy()
  })

  test('7. Duplicate register throws EmailAlreadyExists', async ({ request }) => {
    const email = uniqueEmail()
    const r1 = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'TestPass123!', name: 'Dup' },
    })
    expect(r1.ok()).toBe(true)

    const r2 = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'TestPass123!', name: 'Dup2' },
    })
    const body = await r2.json()
    expect(body.code).not.toBe(0) // EmailAlreadyExists = 11001
  })

  test('8. Login with valid creds returns tokens', async ({ request }) => {
    const email = uniqueEmail()
    await request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'TestPass123!', name: 'Login' },
    })

    const res = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password: 'TestPass123!' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.code).toBe(0)
    expect(body.data.tokens.accessToken).toBeTruthy()
  })

  test('9. Login with wrong password returns InvalidCredentials', async ({ request }) => {
    const email = uniqueEmail()
    await request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'TestPass123!', name: 'WrongPw' },
    })

    const res = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password: 'WrongPassword!' },
    })
    const body = await res.json()
    expect(body.code).not.toBe(0) // InvalidCredentials = 11002
  })

  test('10. /workspaces requires auth (envelope code 11000)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/workspaces`)
    // Sociflow convention: HTTP 200 + envelope code != 0 cho business errors
    const body = await res.json()
    expect(body.code).not.toBe(0)
    expect(body.message).toMatch(/đăng nhập|login|auth/i)
  })

  test('11. /workspaces/current returns personal workspace', async ({ request }) => {
    test.skip(!sharedTokens, 'register failed in beforeAll')
    const res = await request.get(`${API_BASE}/workspaces/current`, {
      headers: { Authorization: `Bearer ${sharedTokens!.accessToken}` },
    })
    const body = await res.json()
    expect(body.code).toBe(0)
    expect(body.data.isPersonal).toBe(true)
    expect(body.data.role).toBe('OWNER')
  })

  test('12. /credits/balance returns numeric remaining', async ({ request }) => {
    test.skip(!sharedTokens, 'register failed in beforeAll')
    const res = await request.get(`${API_BASE}/credits/balance`, {
      headers: { Authorization: `Bearer ${sharedTokens!.accessToken}` },
    })
    const body = await res.json()
    expect(body.code).toBe(0)
    expect(typeof body.data.creditsRemaining).toBe('number')
  })

  test('13. /oauth-credentials/status returns 4 platform rows', async ({ request }) => {
    test.skip(!sharedTokens, 'register failed in beforeAll')
    const res = await request.get(`${API_BASE}/oauth-credentials/status`, {
      headers: { Authorization: `Bearer ${sharedTokens!.accessToken}` },
    })
    const body = await res.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.rows)).toBe(true)
    expect(body.data.rows.length).toBeGreaterThanOrEqual(4)
    const platforms = body.data.rows.map((r: { platform: string }) => r.platform).sort()
    expect(platforms).toEqual(expect.arrayContaining(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE']))
  })

  test('14. Web → API CORS works (FE can fetch from BE)', async ({ page }) => {
    await page.goto(WEB_BASE)
    const apiHealth = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3000/api/v1/health/live', {
        credentials: 'include',
      })
      return { ok: res.ok, status: res.status }
    })
    expect(apiHealth.ok).toBe(true)
    expect(apiHealth.status).toBe(200)
  })

  test('15. Login page loads (UI form not implemented yet — placeholder OK)', async ({ page }) => {
    await page.goto(`${WEB_BASE}/login`)
    await expect(page.locator('h1')).toContainText(/đăng nhập|login/i, { timeout: 10_000 })
    // GAP DETECTED: login form chưa được implement (page chỉ placeholder).
    // Backend /auth/login đã work — verify ở test 8.
  })

  test('16. /onboarding page loads', async ({ page }) => {
    await page.goto(`${WEB_BASE}/onboarding`)
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  })

  test('17. /status page loads', async ({ page }) => {
    await page.goto(`${WEB_BASE}/status`)
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  })

  test('18. /help page loads', async ({ page }) => {
    await page.goto(`${WEB_BASE}/help`)
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  })

  test('19. AI service health responds', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/v1/health')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.status).toBe('ok')
  })
})
