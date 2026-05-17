/// <reference types="chrome" />

/**
 * Handler cho `s2a:selectors-update` từ server.
 * Ghi cache vào chrome.storage.local — content script đọc qua selector-loader.
 */

import type { SelectorsUpdate } from '@sociflow/ws-protocol'
import { writeSelectorsCache } from '../shared/selector-loader'

export async function applySelectorsUpdate(payload: SelectorsUpdate): Promise<void> {
  await writeSelectorsCache(payload.platform, payload.selectors, payload.version)
  console.warn(
    `[sociflow-agent] selectors updated: ${payload.platform} v${payload.version} (${Object.keys(payload.selectors).length} keys)`,
  )
}
