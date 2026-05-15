---
name: setup-mcp-docs
description: Port MCP docs-server pattern từ nextjs-boilerplate sang sociflow — index docs/, CLAUDE.md, .claude/rules/* qua stdio MCP server với 3 tools (docs_list, docs_search, docs_read). Use khi user yêu cầu "/setup-mcp-docs" hoặc muốn setup docs MCP.
---

# Skill: setup-mcp-docs

Port MCP docs-server pattern từ [nextjs-boilerplate](https://github.com/nguyendinhphongdx/nextjs-boilerplate) `mcp/docs-server/` để Claude Code agent đọc docs nhanh hơn (không phải dò glob nhiều lần).

## Mục đích

Agent thường xuyên đọc:
- `CLAUDE.md` (project instruction)
- `.claude/rules/*.md` (rule cứng)
- `docs/**/*.md` (architecture, data model, features, ADRs)

→ Mỗi lần phải glob + read tốn round trip. MCP docs-server expose 3 tools để agent gọi 1 phát ra structured result.

## Output checklist

```
sociflow/
├── mcp/
│   └── docs-server/
│       ├── index.js              # MCP stdio server
│       └── package.json          # ESM, depends @modelcontextprotocol/sdk
├── scripts/
│   └── build-docs-index.js       # build docs/index.json từ markdown
├── docs/
│   └── index.json                # generated, gitignored hoặc commit-track tuỳ
├── .mcp.json                     # đăng ký MCP server (đã có)
└── package.json                  # scripts: docs:index, mcp:start
```

Plus:
- [ ] Hook post-edit auto-rebuild index khi sửa markdown
- [ ] Add `docs/index.json` vào `.gitignore` HOẶC commit-track (tuỳ flow)

## Inputs

Skill không cần input — chạy 1 lần khi setup project.

## Step-by-step

### 1. Tạo `scripts/build-docs-index.js`

```js
#!/usr/bin/env node
// scripts/build-docs-index.js
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const OUT = join(REPO_ROOT, 'docs', 'index.json')

const INCLUDE_PATHS = [
  'CLAUDE.md',
  '.claude/rules',
  'docs',
]

const EXCLUDE = /node_modules|\.next|dist|build|\.turbo/

async function walk(dir) {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const p = join(dir, e.name)
    if (EXCLUDE.test(p)) continue
    if (e.isDirectory()) files.push(...await walk(p))
    else if (e.name.endsWith('.md')) files.push(p)
  }
  return files
}

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const fm = {}
  for (const line of m[1].split('\n')) {
    const [k, ...rest] = line.split(':')
    if (k && rest.length) fm[k.trim()] = rest.join(':').trim()
  }
  return fm
}

function extractHeadings(md) {
  return [...md.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(m => ({
    level: m[1].length,
    text: m[2].trim(),
  })).slice(0, 30)
}

function extractSummary(md) {
  const stripped = md.replace(/^---[\s\S]*?---\n/, '').replace(/^#.*$/gm, '').trim()
  return stripped.split('\n').filter(l => l.trim()).slice(0, 3).join(' ').slice(0, 240)
}

async function main() {
  const allFiles = []
  for (const p of INCLUDE_PATHS) {
    const abs = join(REPO_ROOT, p)
    if (!existsSync(abs)) continue
    const stat = await import('node:fs').then(fs => fs.statSync(abs))
    if (stat.isFile()) allFiles.push(abs)
    else allFiles.push(...await walk(abs))
  }

  const entries = []
  for (const file of allFiles) {
    const content = await readFile(file, 'utf-8')
    const fm = parseFrontmatter(content)
    entries.push({
      path: relative(REPO_ROOT, file).replace(/\\/g, '/'),
      title: fm.title ?? fm.name ?? content.match(/^#\s+(.+)$/m)?.[1] ?? file,
      description: fm.description,
      tags: fm.tags?.split(',').map(s => s.trim()) ?? [],
      summary: extractSummary(content),
      headings: extractHeadings(content),
      size: content.length,
    })
  }

  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2))
  console.log(`Indexed ${entries.length} files → ${OUT}`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

### 2. Tạo `mcp/docs-server/package.json`

```json
{
  "name": "@sociflow/mcp-docs-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "sociflow-docs-mcp": "./index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### 3. Tạo `mcp/docs-server/index.js`

```js
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')
const INDEX_PATH = join(REPO_ROOT, 'docs', 'index.json')

let indexCache = null
async function loadIndex() {
  if (indexCache) return indexCache
  const content = await readFile(INDEX_PATH, 'utf-8')
  indexCache = JSON.parse(content)
  return indexCache
}

const server = new Server(
  { name: 'sociflow-docs', version: '0.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'docs_list',
      description: 'List all indexed documentation files',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'docs_search',
      description: 'Search documentation by keyword (title, summary, headings, tags)',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
    {
      name: 'docs_read',
      description: 'Read full markdown content of a documentation file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative path from repo root' } },
        required: ['path'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'docs_list') {
    const index = await loadIndex()
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(index.entries.map(e => ({
          path: e.path, title: e.title, description: e.description, tags: e.tags,
        })), null, 2),
      }],
    }
  }

  if (name === 'docs_search') {
    const index = await loadIndex()
    const q = args.query.toLowerCase()
    const hits = index.entries.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.summary?.toLowerCase().includes(q) ||
      e.tags?.some(t => t.toLowerCase().includes(q)) ||
      e.headings?.some(h => h.text.toLowerCase().includes(q)),
    )
    return {
      content: [{ type: 'text', text: JSON.stringify(hits, null, 2) }],
    }
  }

  if (name === 'docs_read') {
    const absPath = resolve(REPO_ROOT, args.path)
    if (!absPath.startsWith(REPO_ROOT)) {
      throw new Error('Path traversal denied')
    }
    const content = await readFile(absPath, 'utf-8')
    return { content: [{ type: 'text', text: content }] }
  }

  throw new Error(`Unknown tool: ${name}`)
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

### 4. Update root `package.json` scripts

```json
{
  "scripts": {
    "docs:index": "node scripts/build-docs-index.js",
    "mcp:docs": "node mcp/docs-server/index.js"
  }
}
```

### 5. Update `.mcp.json` đăng ký server

Đọc `.mcp.json` hiện tại của sociflow. Thêm entry `sociflow-docs`:

```json
{
  "mcpServers": {
    "sociflow-docs": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/docs-server/index.js"]
    }
  }
}
```

### 6. (Optional) Post-edit hook auto-rebuild

```json
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_TOOL_PATH\" | grep -qE '\\.(md)$'; then pnpm docs:index > /dev/null 2>&1; fi"
          }
        ]
      }
    ]
  }
}
```

Hoặc đơn giản hơn: chạy `pnpm docs:index` thủ công sau khi sửa docs nhiều.

### 7. Initial build + verify

```bash
cd sociflow/
pnpm docs:index
cat docs/index.json | head -50          # verify cấu trúc
node mcp/docs-server/index.js           # smoke test stdio (ctrl-C exit)
```

### 8. Add `.gitignore`

```gitignore
# Option A: regenerate locally, don't commit
docs/index.json

# Option B: commit-track (helps reviewer + offline agent)
# (không add)
```

Khuyến nghị: **commit-track** trong giai đoạn early — index nhỏ, agent dùng được khi clone repo fresh.

## Verify checklist

- [ ] `pnpm docs:index` chạy không error
- [ ] `docs/index.json` exist với `entries` array
- [ ] `node mcp/docs-server/index.js` start được (stdio server listening)
- [ ] `.mcp.json` có entry `sociflow-docs`
- [ ] Restart Claude Code → kiểm tra agent có thể gọi tool `mcp__sociflow-docs__docs_list`

## References

- nextjs-boilerplate `mcp/docs-server/` — reference (port nguyên, đổi `REPO_ROOT` + frontmatter convention)
- [Model Context Protocol](https://modelcontextprotocol.io/) — spec
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
