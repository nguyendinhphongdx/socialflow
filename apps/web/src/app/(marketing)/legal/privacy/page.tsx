import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Sociflow',
  description: 'How Sociflow collects, uses, and protects your data',
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: 2026-05-17</p>

      <h2>1. Introduction</h2>
      <p>
        Sociflow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a social media management
        platform that helps creators and agencies publish content, automate engagement, and
        track analytics across multiple platforms (Facebook, Instagram, TikTok, YouTube).
      </p>
      <p>
        This Privacy Policy explains what data we collect, how we use it, and your rights.
      </p>

      <h2>2. Data we collect</h2>

      <h3>Account data</h3>
      <ul>
        <li>Email, name, password hash (bcrypt cost 12)</li>
        <li>Profile picture URL (optional)</li>
        <li>Login timestamps + IP for security audit</li>
      </ul>

      <h3>Social account credentials</h3>
      <ul>
        <li>OAuth access tokens — encrypted at rest with AES-256-GCM</li>
        <li>OAuth refresh tokens — encrypted at rest</li>
        <li>Platform user ID and display name</li>
        <li>Granted scopes list</li>
      </ul>

      <h3>Content data</h3>
      <ul>
        <li>Posts you compose (title, body, media references)</li>
        <li>Media uploaded to our Cloudflare R2 storage (EXIF stripped on upload)</li>
        <li>Publish history and metadata</li>
      </ul>

      <h3>Engagement data</h3>
      <ul>
        <li>Comments fetched from your connected platforms via webhook or polling</li>
        <li>Auto-reply rules you configure</li>
        <li>Analytics snapshots (followers, engagement, reach)</li>
      </ul>

      <h3>Usage data</h3>
      <ul>
        <li>Anonymized error reports (via Sentry, no PII)</li>
        <li>Aggregate usage metrics (no individual tracking)</li>
      </ul>

      <h2>3. How we use your data</h2>
      <ul>
        <li>To publish your content to your connected social platforms when you initiate</li>
        <li>To fetch comments and engagement metrics for the dashboard</li>
        <li>To send transactional emails (verify email, password reset, alerts)</li>
        <li>To bill your subscription via Stripe (we do not store card data)</li>
      </ul>

      <p>
        <strong>We do not</strong> sell your data, use it for advertising, or share it with
        third parties except as required to operate the service (Stripe for billing, Cloudflare
        for storage, AWS SES/Resend for email).
      </p>

      <h2>4. Data retention</h2>
      <ul>
        <li>Account data: retained while account is active</li>
        <li>Soft-deleted account: hard-deleted after 30 days</li>
        <li>OAuth tokens: deleted immediately when you disconnect an account</li>
        <li>Content and media: retained while account is active, deleted on account deletion</li>
        <li>Logs: 90 days rolling</li>
        <li>Backups: 30 days retention</li>
      </ul>

      <h2>5. Your rights</h2>
      <ul>
        <li>
          <strong>Access</strong>: request a copy of all data we hold about you at
          {' '}<a href="mailto:privacy@sociflow.io">privacy@sociflow.io</a>
        </li>
        <li>
          <strong>Delete</strong>: visit <a href="/auth/data-deletion">data deletion page</a>
          {' '}to request permanent account deletion. Processed within 30 days.
        </li>
        <li>
          <strong>Correct</strong>: edit your profile in <a href="/dashboard/settings">settings</a>
        </li>
        <li>
          <strong>Disconnect</strong>: remove any connected social account at any time. Tokens
          are deleted immediately.
        </li>
        <li>
          <strong>Export</strong>: download your data in JSON via settings
        </li>
      </ul>

      <h2>6. Security</h2>
      <ul>
        <li>OAuth tokens encrypted at rest (AES-256-GCM)</li>
        <li>Passwords hashed with bcrypt (cost 12)</li>
        <li>TLS 1.3 for all client-server communication</li>
        <li>Refresh token rotation with replay detection</li>
        <li>Rate limiting on auth endpoints</li>
        <li>Independent security review before each major release</li>
      </ul>

      <h2>7. Children</h2>
      <p>
        Sociflow is not intended for users under 13. We do not knowingly collect data from
        children under 13. If you believe a child has registered, contact us to remove.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Data is processed in Vietnam (primary), Singapore (backup), and the United States
        (Cloudflare R2). By using Sociflow, you consent to these transfers.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will notify you by email and in-app banner at least 30 days before any material
        change to this policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions:{' '}<a href="mailto:privacy@sociflow.io">privacy@sociflow.io</a>
        <br />
        DPO / GDPR requests:{' '}<a href="mailto:dpo@sociflow.io">dpo@sociflow.io</a>
        <br />
        Postal: [Your registered business address]
      </p>
    </article>
  )
}
