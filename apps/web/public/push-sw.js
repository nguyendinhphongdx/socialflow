/* eslint-disable no-restricted-globals */
/**
 * Service Worker dành riêng cho Web Push notification.
 *
 * Đăng ký từ FE qua `navigator.serviceWorker.register('/push-sw.js')`.
 * KHÔNG dùng cho cache/PWA (giữ scope tối thiểu để tránh conflict Next.js).
 *
 * Payload từ server (PushService): JSON với { title, body, url?, tag?, icon?, data? }.
 */

self.addEventListener('install', (event) => {
  // Activate ngay không chờ tab refresh.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = { title: 'Sociflow', body: 'Bạn có thông báo mới' }
  try {
    payload = event.data.json()
  } catch (_err) {
    payload.body = event.data.text() || payload.body
  }

  const title = payload.title || 'Sociflow'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag,
    data: { url: payload.url, ...(payload.data || {}) },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu có tab Sociflow đang mở → focus + navigate.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) {
            try { client.navigate(targetUrl) } catch (_e) { /* ignore */ }
          }
          return
        }
      }
      // Else open new tab.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})
