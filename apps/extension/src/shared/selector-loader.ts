/// <reference types="chrome" />

/**
 * Selector loader cho content script.
 *
 * Strategy:
 * 1. Read cache từ `chrome.storage.local` (key `selectors:<platform>`)
 * 2. Validate TTL 24h; nếu hết hạn → vẫn dùng (better stale than nothing)
 * 3. Server push `s2a:selectors-update` qua WS → background ghi cache mới
 * 4. Fallback FALLBACK_SELECTORS hardcode nếu chưa có cache lần đầu
 *
 * Content script gọi `loadSelectors('FACEBOOK')` → object key→value selector.
 * TODO(real-dom): các selector hiện là placeholder data-testid, cần inspect
 * DOM thực tế của FB/IG/YT Studio rồi seed DB + push qua WS.
 */

import type { AgentPlatform } from '@sociflow/ws-protocol'

const STORAGE_PREFIX = 'selectors:'
const TTL_MS = 24 * 60 * 60 * 1000

export interface SelectorCacheEntry {
  platform: AgentPlatform
  selectors: Record<string, string>
  version: number
  updatedAt: number
}

/**
 * Placeholder selectors — chỉ dùng khi chưa có cache lần đầu.
 * KHI có real DOM access → server push update qua WS sẽ override.
 *
 * Key convention: `<area>.<element>` (lowercase, dot-separated).
 */
const FALLBACK_SELECTORS: Record<AgentPlatform, Record<string, string>> = {
  TIKTOK: {
    'upload.file-input': 'input[type="file"][accept*="video"]',
    'composer.caption': '[data-e2e="caption-input"]',
    'composer.privacy': '[data-e2e="privacy-select"]',
    'composer.post-button': '[data-e2e="post-button"]',
    'result.post-link': '[data-e2e="upload-success-link"]',
  },
  FACEBOOK: {
    // TODO(real-dom): inspect facebook.com composer, replace with stable selectors
    'composer.entry': '[aria-label="Create a post"]',
    'composer.entry-alt': 'div[role="button"][aria-label*="mind"]',
    'composer.textarea': 'div[role="dialog"] [contenteditable="true"]',
    'composer.media-button': '[aria-label="Photo/video"]',
    'composer.file-input': 'input[type="file"][accept*="image"]',
    'composer.post-button': 'div[role="dialog"] [aria-label="Post"]',
    'result.toast': '[role="status"]',
  },
  INSTAGRAM: {
    // TODO(real-dom): inspect instagram.com create flow
    'composer.entry': 'svg[aria-label="New post"]',
    'composer.file-input': 'input[type="file"][accept*="image"]',
    'composer.next-button': 'div[role="button"]:has-text("Next")',
    'composer.caption': 'textarea[aria-label="Write a caption..."]',
    'composer.share-button': 'div[role="button"]:has-text("Share")',
    'result.success-toast': '[role="dialog"]:has-text("Your post has been shared")',
  },
  YOUTUBE: {
    // TODO(real-dom): inspect studio.youtube.com upload flow
    'upload.create-button': 'ytcp-button#create-icon',
    'upload.menu-upload': 'tp-yt-paper-item#text-item-0',
    'upload.file-input': 'input[type="file"]',
    'upload.title': 'ytcp-mention-textbox[label="Title"] #textbox',
    'upload.description': 'ytcp-mention-textbox[label="Description"] #textbox',
    'upload.visibility-public': 'tp-yt-paper-radio-button[name="PUBLIC"]',
    'upload.publish-button': 'ytcp-button#done-button',
    'result.video-url': 'ytcp-video-info span.video-url-fadeable',
  },
}

function storageKey(platform: AgentPlatform): string {
  return `${STORAGE_PREFIX}${platform}`
}

async function readCache(platform: AgentPlatform): Promise<SelectorCacheEntry | null> {
  const key = storageKey(platform)
  const result = await chrome.storage.local.get(key)
  const raw = result[key]
  if (!raw || typeof raw !== 'object') return null
  return raw as SelectorCacheEntry
}

export async function loadSelectors(platform: AgentPlatform): Promise<Record<string, string>> {
  const cached = await readCache(platform)
  if (cached?.selectors) {
    const age = Date.now() - cached.updatedAt
    if (age > TTL_MS) {
      console.warn(`[sociflow-agent] selectors cache stale for ${platform} (${Math.round(age / 1000 / 60)}min)`)
    }
    // Merge cache trên fallback — server-side có thể chưa cover hết key.
    return { ...FALLBACK_SELECTORS[platform], ...cached.selectors }
  }
  return { ...FALLBACK_SELECTORS[platform] }
}

/**
 * Background side — gọi khi nhận `s2a:selectors-update`.
 */
export async function writeSelectorsCache(
  platform: AgentPlatform,
  selectors: Record<string, string>,
  version: number,
): Promise<void> {
  const entry: SelectorCacheEntry = {
    platform,
    selectors,
    version,
    updatedAt: Date.now(),
  }
  await chrome.storage.local.set({ [storageKey(platform)]: entry })
}

export function getFallbackSelectors(platform: AgentPlatform): Record<string, string> {
  return { ...FALLBACK_SELECTORS[platform] }
}
