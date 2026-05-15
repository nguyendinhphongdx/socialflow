---
title: MCP server setup
description: Cách cấu hình và dùng MCP server để Claude tra cứu docs nhanh
audience: [ai-agent, developer]
---

# MCP server setup

Sociflow đi kèm 2 MCP server cho Claude Code (và bất kỳ MCP client nào). Cấu hình ở [`.mcp.json`](../.mcp.json) tại project root — Claude Code tự load khi mở folder này.

## Server 1: `sociflow-docs`

**Image**: `@modelcontextprotocol/server-filesystem` (qua npx)
**Mount**: `./docs`, `./.claude`

### Tools cung cấp

| Tool | Use case |
|---|---|
| `read_file` | Đọc 1 file cụ thể trong docs |
| `read_multiple_files` | Đọc batch nhiều file (vd nạp tất cả rules) |
| `write_file` | Tạo/ghi đè file (dùng khi cập nhật docs) |
| `edit_file` | Edit incremental |
| `create_directory` | Tạo subfolder |
| `list_directory` | Liệt kê file/folder |
| `directory_tree` | Show toàn bộ cây thư mục — dùng khi onboard |
| `move_file` | Rename/move |
| `search_files` | Glob/grep tìm file |
| `get_file_info` | Metadata |

### Workflow khuyến nghị

1. **Onboard ngữ cảnh nhanh**:
   - Gọi `directory_tree` trên `./docs` → có overview
   - Đọc `docs/INDEX.md` → biết tìm gì ở đâu
   - Đọc `CLAUDE.md` (ở root, không trong docs nhưng có thể đọc thường) → rule chung

2. **Tra cứu intent-based**:
   - Search keyword bằng `search_files` (vd: `search_files(path=".", pattern="oauth")`)
   - Hoặc jump trực tiếp bằng `read_file` nếu biết file đích từ INDEX

3. **Update docs**:
   - Dùng `edit_file` (preferred) hoặc `write_file`
   - Sau update, sửa luôn `docs/INDEX.md` nếu structure đổi

## Server 2: `sociflow-memory`

**Image**: `@modelcontextprotocol/server-memory`
**Purpose**: Knowledge graph cục bộ — entity + relation + observation

### Tools cung cấp

| Tool | Use case |
|---|---|
| `create_entities` | Define entity domain (User, Account, PublishRecord...) |
| `create_relations` | Quan hệ giữa entity |
| `add_observations` | Ghi nhận đặc tính/quirk |
| `delete_entities` / `delete_relations` / `delete_observations` | Cleanup |
| `read_graph` | Dump toàn graph |
| `search_nodes` | Tìm entity |
| `open_nodes` | Đọc chi tiết |

### Khi nào dùng

- Exploration codebase phức tạp, cần track nhiều entity tạm thời trong phiên
- Cần ghi nhớ quirk của platform (vd: "TikTok upload yêu cầu video MP4 codec H.264, max 287s")
- Onboard agent mới trong session dài (memory bridge giữa các sub-task)

**Không dùng cho**: persistent project memory — đó là việc của `.claude/` và `docs/`. Memory MCP là session-scoped.

## Verify setup

Trong Claude Code, sau khi mở folder `sociflow/`:

```
/mcp
```

Sẽ thấy 2 server `sociflow-docs` và `sociflow-memory` connected. Nếu chưa, restart Claude Code hoặc check `.mcp.json` syntax.

## Thêm MCP server khác (tương lai)

Khi cần thêm capability, edit `.mcp.json`:

```json
{
  "mcpServers": {
    "sociflow-docs": { ... },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

Các MCP server hữu ích sau này:
- **`server-github`**: thao tác PR/issue
- **`server-postgres`**: query DB trực tiếp khi debug
- **`server-puppeteer`**: test browser automation extension
- **`server-fetch`**: lấy docs API platform live

## Best practice

- ✅ Mỗi lần phiên dài, gọi `read_file("docs/INDEX.md")` trước khi search lung tung
- ✅ Khi build feature mới, đọc theo path trong INDEX section "Lookup theo intent"
- ✅ Update INDEX.md khi thêm file mới
- ❌ Đừng cache stale docs trong memory MCP — đọc lại từ filesystem khi cần thông tin chính xác
- ❌ Đừng dùng `write_file` qua MCP cho code application — đó là việc của Edit/Write tool. MCP filesystem chỉ cho docs/.claude/.
