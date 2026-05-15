---
title: ADR-0003 Chrome Extension only (không làm Electron/Desktop)
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0003 — Chrome Extension only cho automation

## Status

Accepted.

## Context

Một số platform (đặc biệt TikTok) khó/lâu pass OAuth review. Cần cơ chế backup cho user không có API access → automation. Câu hỏi: dùng dạng nào?

User profile: VN solo creator, không kỹ thuật.

## Decision

**Chỉ làm Chrome browser extension (Manifest V3)**. Không làm Electron, Tauri, hay server-side headless automation.

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| **Chrome Extension only** ✓ | 1-click install, session login sẵn, ít detect, free hosting Chrome Web Store | Giới hạn browser context, không có ffmpeg native | Match 90% use case |
| Electron desktop | Full power, ffmpeg native, tray | 100MB binary, install friction lớn, OS-specific build + signing đau | Solo không kham nổi |
| Tauri desktop | 5MB, Rust + system webview | Rust learning curve, ecosystem nhỏ | Phase 1-6 không cần extra power |
| Extension + Tauri | Cover hết case | 2x maintenance | Premature optimization |
| Server-side Playwright | Không cần user cài gì | Bot detection cao, infra cost, legal gray | Risk cao |
| Native messaging (extension + small native exe) | Extension + filesystem | Setup phức tạp, OS-specific | Marginal value |

## Consequences

### Positive

- **Install friction tối thiểu**: 1 click Chrome Web Store
- **Cross-OS automatic**: Windows/Mac/Linux đều dùng được
- **Session reuse**: user đã login TikTok/FB/IG/YT trong Chrome → extension dùng luôn
- **Anti-detection tốt**: fingerprint thật của user
- **No password storage**: không lưu password user lên server
- **Auto-update**: qua Chrome Web Store
- **CSP enforced**: bảo mật tốt
- **Reach rộng**: Chrome 70%+ thị phần VN

### Negative

- **Không có ffmpeg native**: không transcode video local trước khi upload → user phải upload file đúng spec platform
- **Không có system tray**: phải mở Chrome để chạy schedule
- **Không có multiple browser profile native**: 1 extension = 1 Chrome profile = 1 set account
- **MV3 limitations**: service worker có TTL, phải dùng offscreen documents cho file ops
- **Chrome Web Store policy**: có thể reject automation tools → fallback distribute qua sociflow.io download
- **Firefox/Safari không cover**: ~20% user (Phase 7+ cân nhắc port)

### Mitigation

- **ffmpeg cần thiết** → server-side gen video đã transcode đúng spec từ phase 4 (AI gen video)
- **System tray** → web schedule + cron BE thay vì agent tự schedule
- **Multi-profile** → user dùng nhiều Chrome profile + cài extension nhiều lần (mỗi profile pair với agent riêng)
- **Web Store reject** → fallback self-host .crx download + manual install instruction
- **Firefox port** → Phase 8+ nếu có demand

## References

- [05-automation-extension.md](../05-automation-extension.md)
- [02-architecture.md](../02-architecture.md)
- AiToEarn dùng Electron — quá nặng cho solo
