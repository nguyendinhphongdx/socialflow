---
title: Glossary
description: Thuật ngữ domain Sociflow
audience: [all]
---

# Glossary

## Sản phẩm

| Term | Định nghĩa |
|---|---|
| **Account** (social account) | Tài khoản platform mà user kết nối (1 user có thể có N account). Khác với User của Sociflow. |
| **Account group** | Nhóm gom các social account, thường theo brand/client. |
| **Publish record** | Record của 1 lần đăng bài lên 1 platform. 1 post lên 4 platform = 4 record. |
| **Flow / flow ID** | Bundle ID gom nhiều publish record của cùng 1 lần đăng multi-platform. |
| **Draft** | Bản nháp post, chưa publish. |
| **Publish mode** | Cách đăng bài: API (OAuth), AUTOMATION (extension), HYBRID. |
| **Agent (automation)** | Browser extension đã pair với user account. |
| **Pair code** | 6 chữ số TTL 5 phút để link extension với user. |
| **MediaAsset** | File media (image/video) trong R2, có metadata. |
| **AI job** | 1 lần gen AI (text/image/video), tracked cho cost + status. |
| **Credit** | Đơn vị tiêu thụ AI. Mỗi user có quota tháng. |
| **Engagement** | Tương tác: like, comment, share, follow. |
| **Engagement policy** | Cấu hình auto-reply per account. |
| **Brand mention** | Lần keyword brand xuất hiện trên platform. |

## Kỹ thuật

| Term | Định nghĩa |
|---|---|
| **api** | NestJS service chính (`apps/api`), business logic. |
| **ai** | NestJS service AI (`apps/ai`), gen + agent. |
| **web** | Next.js frontend (`apps/web`). |
| **extension** | Chrome MV3 browser extension (`apps/extension`). |
| **DTO** | Data Transfer Object — input validation từ zod. |
| **VO** | View Object — response shape, không expose internal field. |
| **Repository** | Class wrap Prisma access, thin layer, no business logic. |
| **Provider** | Strategy implementation cho 1 platform (YoutubeProvider, FbProvider...). |
| **AppException** | Exception class trigger global filter, return business error code. |
| **ResponseCode** | Enum business error code (10000+). |
| **Idempotency key** | Header để dedupe write request. |
| **Webhook event** | Incoming callback từ platform (TT review, FB feedback). |
| **Internal token** | Shared secret giữa api ↔ ai service. |
| **Agent token** | Long-lived JWT cho extension auth. |

## Workflow / lifecycle

| Term | Định nghĩa |
|---|---|
| **DISPATCHED** | Status sau khi enqueue, chờ worker pick. |
| **IN_PROGRESS** | Worker đang xử lý. |
| **REVIEW_PENDING** | Platform đang review (TikTok). |
| **PUBLISHED** | Đã đăng thành công. |
| **REJECTED** | Platform reject (content policy). |
| **WAITING_AGENT** | Mode AUTOMATION, agent offline, đợi online retry. |

## Domain & business

| Term | Định nghĩa |
|---|---|
| **MVP** | Minimum Viable Product — feature tối thiểu để launch. |
| **OPC** | One-person company — solo entrepreneur (term AiToEarn dùng). |
| **MRR** | Monthly Recurring Revenue. |
| **TAM** | Total Addressable Market. |
| **Churn** | Tỉ lệ user huỷ subscription. |
| **CPS / CPE / CPM** | Cost-per-Sale / Cost-per-Engagement / Cost-per-Mille (impression). |
| **Creator economy** | Hệ sinh thái creator → audience → monetization. |
| **MCN** | Multi-Channel Network — agency quản nhiều creator. |

## Viết tắt

| | Full |
|---|---|
| ADR | Architecture Decision Record |
| WS | WebSocket |
| OAuth | Open Authorization |
| TOS | Terms of Service |
| CSP | Content Security Policy |
| MV3 | Chrome Manifest V3 |
| DOM | Document Object Model |
| FE / BE | Frontend / Backend |
| DX | Developer Experience |
| RBAC | Role-Based Access Control |
| TTL | Time To Live |
| CRUD | Create Read Update Delete |
| DI | Dependency Injection |
| ORM | Object-Relational Mapping |
| RDBMS | Relational Database Management System |
| CDN | Content Delivery Network |
| SSR | Server-Side Rendering |
| KPI | Key Performance Indicator |

## Platform-specific terms

| Platform | Term | Định nghĩa |
|---|---|---|
| Meta | Graph API | REST API cho FB/IG/Threads |
| Meta | Page | FB Page (business page, khác personal profile) |
| Meta | Business Manager | Tool quản page + ad |
| YouTube | Channel | Tài khoản YT |
| YouTube | Studio | studio.youtube.com — backend tool YT |
| YouTube | Data API | API v3 quản video + analytics |
| YouTube | Shorts | Video dạng < 60s, vertical |
| TikTok | Content Posting API | TT API cho upload video |
| TikTok | Display API | TT API cho engagement (limited) |
| TikTok | Creator Center | TT studio web |
| Instagram | Reel | Video 15-90s, vertical |
| Instagram | Business / Creator account | Cần để dùng Graph API |

## Term mới

Khi thêm term:
1. Thêm vào file này theo alphabet trong section đúng
2. Nếu term có scope rộng, cân nhắc tạo doc riêng
