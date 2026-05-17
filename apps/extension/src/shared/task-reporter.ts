/// <reference types="chrome" />

/**
 * Helper chuẩn hoá message gửi từ content script lên background.
 *
 * Stage chuẩn cho mọi platform publish flow (5 bước):
 * - navigate     — mở/redirect tới composer URL
 * - compose      — fill title/body
 * - attach-media — upload ảnh/video
 * - submit       — click Post/Share/Publish
 * - verify       — extract platformPostId + workLink
 */

export type PublishStage =
  | 'navigate'
  | 'compose'
  | 'attach-media'
  | 'submit'
  | 'verify'

const STAGE_PROGRESS: Record<PublishStage, number> = {
  'navigate': 10,
  'compose': 30,
  'attach-media': 55,
  'submit': 80,
  'verify': 95,
}

export function reportStage(taskId: string, stage: PublishStage): void {
  void chrome.runtime.sendMessage({
    type: 'TASK_STATUS',
    taskId,
    stage,
    progress: STAGE_PROGRESS[stage],
  }).catch(() => {})
}

export function reportComplete(
  taskId: string,
  platformPostId: string,
  workLink: string,
): void {
  void chrome.runtime.sendMessage({
    type: 'TASK_COMPLETE',
    taskId,
    platformPostId,
    workLink,
  }).catch(() => {})
}

export function reportFailed(
  taskId: string,
  reason: string,
  options?: { recoverable?: boolean, screenshotUrl?: string | null },
): void {
  void chrome.runtime.sendMessage({
    type: 'TASK_FAILED',
    taskId,
    reason,
    recoverable: options?.recoverable ?? false,
    screenshotUrl: options?.screenshotUrl ?? null,
  }).catch(() => {})
}
