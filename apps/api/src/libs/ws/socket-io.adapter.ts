import type { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { ServerOptions } from 'socket.io'
import { APP_CONFIG, type AppConfig } from '../../config'

/**
 * Custom Socket.IO adapter — đọc CORS whitelist từ `AppConfig` thay vì cho phép tất cả origin.
 *
 * Whitelist:
 * - `config.app.corsOrigins` (web app + dev hosts)
 * - `chrome-extension://*` (extension agent — runtime ID không cố định)
 *
 * `credentials: false` vì extension dùng Authorization header (Bearer agent token) qua
 * `handshake.auth.token`, không phụ thuộc cookie.
 */
export class SociflowSocketIoAdapter extends IoAdapter {
  private readonly allowedOrigins: Array<string | RegExp>

  constructor(app: INestApplicationContext) {
    super(app)
    const config = app.get<AppConfig>(APP_CONFIG)
    this.allowedOrigins = [
      ...config.app.corsOrigins,
      /^chrome-extension:\/\/.+$/,
    ]
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const allowedOrigins = this.allowedOrigins
    const cors: ServerOptions['cors'] = {
      origin: (origin, callback) => {
        // Không có origin (vd extension service worker, native client) → allow
        if (!origin) return callback(null, true)
        const ok = allowedOrigins.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))
        if (ok) return callback(null, true)
        return callback(new Error('Origin not allowed'), false)
      },
      credentials: false,
    }
    return super.createIOServer(port, { ...options, cors })
  }
}
