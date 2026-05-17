import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion — Sociflow',
  description: 'Request permanent deletion of your Sociflow account and data',
  robots: { index: true, follow: true },
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-6 py-16 prose prose-slate dark:prose-invert">
        <h1>Data Deletion Request</h1>

        <p>
          Bạn có quyền yêu cầu xoá vĩnh viễn toàn bộ dữ liệu tài khoản Sociflow của bạn.
          Yêu cầu này tuân thủ <strong>Meta Platform Terms § 3.b</strong> và{' '}
          <strong>GDPR Art. 17 (Right to be forgotten)</strong>.
        </p>

        <h2>Sẽ xoá những gì?</h2>
        <ul>
          <li>Tài khoản Sociflow + email + password hash</li>
          <li>OAuth tokens của tất cả social account đã connect</li>
          <li>Toàn bộ post draft, publish history, media files</li>
          <li>Auto-reply rules, brand monitor configs, analytics snapshots</li>
          <li>API keys + session history</li>
        </ul>

        <h2>Sẽ giữ lại bao lâu?</h2>
        <ul>
          <li>
            <strong>Soft delete ngay lập tức</strong> — tài khoản bị disable, không login được,
            không API call nào hoạt động.
          </li>
          <li>
            <strong>Hard delete sau 30 ngày</strong> — toàn bộ data bị xoá khỏi DB + R2 storage.
            Backup retention cũng tự expire trong cùng khoảng thời gian.
          </li>
          <li>
            Một số log audit (security incident, fraud detection) có thể giữ thêm 90 ngày
            theo Acceptable Use Policy. Log không chứa PII trực tiếp.
          </li>
        </ul>

        <h2>Cách yêu cầu</h2>

        <h3>Option 1: Tự thực hiện qua UI</h3>
        <ol>
          <li>Đăng nhập <Link href="/login">https://sociflow.io/login</Link></li>
          <li>Vào <Link href="/dashboard/settings">Settings → Account</Link></li>
          <li>Cuộn xuống &quot;Danger Zone&quot; → click &quot;Delete account&quot;</li>
          <li>Nhập email confirm + click button xác nhận lần 2</li>
          <li>Bạn sẽ nhận email confirmation với mã code 16 ký tự</li>
        </ol>

        <h3>Option 2: Email</h3>
        <p>
          Gửi email tới <a href="mailto:privacy@sociflow.io?subject=Data%20Deletion%20Request">
          privacy@sociflow.io</a> với nội dung:
        </p>
        <pre className="bg-muted p-4 rounded-md text-sm">{`Subject: Data Deletion Request

Email tài khoản: <your@email.com>
Lý do (optional): <optional>

Tôi xác nhận yêu cầu xoá vĩnh viễn dữ liệu tài khoản Sociflow.`}</pre>
        <p>Phản hồi trong 5 ngày làm việc. Xử lý hoàn tất trong 30 ngày.</p>

        <h3>Option 3: Facebook/Instagram Data Deletion callback</h3>
        <p>
          Nếu bạn revoke Sociflow trong Facebook Settings → Apps and Websites, Meta sẽ tự
          gửi data deletion callback tới Sociflow. Bạn sẽ nhận confirmation tracking URL.
        </p>

        <h2>Hủy yêu cầu</h2>
        <p>
          Trong vòng 30 ngày trước khi hard delete, bạn có thể hủy bằng cách reply email
          confirmation hoặc login lại (nếu chưa hard delete) → click &quot;Restore account&quot;.
          Sau 30 ngày, data không thể khôi phục.
        </p>

        <h2>Hỗ trợ</h2>
        <p>
          Mọi câu hỏi: <a href="mailto:privacy@sociflow.io">privacy@sociflow.io</a>
          <br />
          DPO: <a href="mailto:dpo@sociflow.io">dpo@sociflow.io</a>
        </p>

        <hr />
        <p className="text-sm text-muted-foreground">
          Last updated: 2026-05-17. See also{' '}
          <Link href="/legal/privacy">Privacy Policy</Link> and{' '}
          <Link href="/legal/terms">Terms of Service</Link>.
        </p>
      </main>
    </div>
  )
}
