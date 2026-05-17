import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Sociflow',
  description: 'Terms and conditions for using Sociflow',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: 2026-05-17</p>

      <h2>1. Acceptance</h2>
      <p>
        By creating an account or using Sociflow (the &quot;Service&quot;), you agree to be bound by
        these Terms of Service. If you do not agree, do not use the Service.
      </p>

      <h2>2. Service description</h2>
      <p>
        Sociflow provides software-as-a-service tools for:
      </p>
      <ul>
        <li>Composing and scheduling posts to Facebook, Instagram, TikTok, YouTube</li>
        <li>Fetching comments and replying via configurable rules</li>
        <li>Generating content captions and images via AI providers (OpenAI, Anthropic, etc.)</li>
        <li>Tracking analytics across connected platforms</li>
      </ul>

      <h2>3. Account responsibilities</h2>
      <ul>
        <li>You are responsible for the security of your password and API keys</li>
        <li>You must be at least 13 years old (or local minimum age) to create an account</li>
        <li>You must provide accurate and current information</li>
        <li>You may not impersonate another person or entity</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree NOT to use Sociflow to:</p>
      <ul>
        <li>Send spam, unsolicited content, or violate platform-specific terms (Meta, TikTok, etc.)</li>
        <li>Distribute illegal, defamatory, or hateful content</li>
        <li>Infringe copyright, trademark, or other intellectual property rights</li>
        <li>Attempt to reverse-engineer, scrape, or abuse the Service</li>
        <li>Use the Service to coordinate inauthentic behavior across multiple accounts</li>
        <li>Bypass rate limits or platform-imposed restrictions through automation</li>
      </ul>

      <h2>5. Subscription and billing</h2>
      <ul>
        <li>Paid plans are billed monthly or annually in advance via Stripe</li>
        <li>Plan tiers: FREE, PRO, BUSINESS, ENTERPRISE</li>
        <li>Cancellation: take effect at the end of the current billing period — no prorated refund</li>
        <li>Price changes: notified 30 days in advance, applied at next renewal</li>
        <li>Failed payment: 7-day grace period, then account is downgraded to FREE</li>
      </ul>

      <h2>6. AI credits</h2>
      <ul>
        <li>AI features (caption gen, image gen) consume credits</li>
        <li>Credits reset monthly on the billing cycle date</li>
        <li>Unused credits do not roll over</li>
        <li>Credits are non-refundable individually but plan downgrades follow §5</li>
      </ul>

      <h2>7. User content</h2>
      <ul>
        <li>You retain all rights to content you upload or generate via Sociflow</li>
        <li>
          You grant Sociflow a limited, worldwide, royalty-free license to store, transmit, and
          process your content solely for the purpose of operating the Service
        </li>
        <li>
          You are solely responsible for ensuring your content complies with the laws and terms
          of each connected social platform
        </li>
      </ul>

      <h2>8. Third-party services</h2>
      <p>
        Sociflow integrates with: Meta (Facebook + Instagram), TikTok, YouTube, OpenAI,
        Anthropic, Stripe, Cloudflare, Sentry. Their terms apply to data flowing through them.
        We are not responsible for service outages or policy changes by these third parties.
      </p>

      <h2>9. Service availability</h2>
      <ul>
        <li>Target uptime: 99.5% (excluding planned maintenance announced 48h in advance)</li>
        <li>No SLA on FREE plan; PRO and above include best-effort support</li>
        <li>ENTERPRISE plan includes contractual SLA — see separate agreement</li>
      </ul>

      <h2>10. Termination</h2>
      <p>
        We may suspend or terminate your account immediately if:
      </p>
      <ul>
        <li>You violate these Terms (especially §4)</li>
        <li>Required by law or court order</li>
        <li>Payment is overdue more than 30 days</li>
        <li>Your usage poses a security or stability risk to other users</li>
      </ul>
      <p>
        You may terminate your account anytime via the{' '}
        <a href="/auth/data-deletion">data deletion page</a>. Hard deletion completes within
        30 days.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        Sociflow is provided &quot;AS IS&quot; without warranty. To the maximum extent permitted by
        law, our total liability for any claim shall not exceed the fees you paid us in the 12
        months preceding the claim.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify Sociflow against claims arising from your content, your use of
        the Service in violation of these Terms, or your violation of third-party rights.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of Vietnam. Disputes shall be resolved in the
        courts of Hanoi.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may update these Terms. Material changes: notified 30 days in advance via email and
        in-app banner. Continued use after the effective date constitutes acceptance.
      </p>

      <h2>15. Contact</h2>
      <p>
        Legal: <a href="mailto:legal@sociflow.io">legal@sociflow.io</a>
        <br />
        Support: <a href="mailto:support@sociflow.io">support@sociflow.io</a>
      </p>
    </article>
  )
}
