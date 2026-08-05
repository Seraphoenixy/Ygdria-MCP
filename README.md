# Ygdria MCP Server

一个轻量的 **MCP ↔ Ygdria ETAPI** 适配器。AI 客户端通过标准 MCP 协议搜索、读取和编辑 Ygdria 笔记；本项目不实现笔记数据库，也不会绕过 Ygdria ETAPI。

```text
AI Client ── MCP/stdio ──> Ygdria MCP Server ── HTTP ETAPI ──> Ygdria Desktop
```

## 要求与安装

- Node.js 18 或更高版本
- 正在运行且已启用 ETAPI 的 Ygdria Desktop
- 用户自己创建的 ETAPI Token

```bash
git clone <this-repository-url> ygdria-mcp
cd ygdria-mcp
npm install
npm run build
Copy-Item ygdria-mcp.example.ini ygdria-mcp.ini  # PowerShell
```

不要把 Token 写入代码、提交到 Git，或放进 MCP 客户端配置。Token 过期后只需更新 INI，并重启 MCP 服务进程。

## 配置

推荐复制 INI 模板并填写：

```ini
[etapi]
token = 你的 ETAPI Token
url = http://127.0.0.1:4318
allowWrite = false
```

模板文件是 `ygdria-mcp.example.ini`，复制后实际配置文件名为 `ygdria-mcp.ini`，且已经加入 `.gitignore`。默认会读取项目根目录中的该文件。

环境变量主要保留给自动化或临时调试使用，优先级高于 INI。日常使用请把短期 Token 放在 `ygdria-mcp.ini`，不要放在 MCP 客户端配置中：

| 环境变量 | 必需 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `YGDRIA_ETAPI_TOKEN` | 条件必需 | INI 中的 `token` | 用户提供的 ETAPI Token |
| `YGDRIA_ETAPI_URL` | 否 | `http://127.0.0.1:4318` | Ygdria ETAPI origin，只允许 HTTP(S) origin，不接受路径 |
| `YGDRIA_ALLOW_WRITE` | 否 | `false` | 设为 `true` 表示用户明确授权本次服务进程提供写工具 |
| `YGDRIA_CONFIG_FILE` | 否 | 项目根目录的 `ygdria-mcp.ini` | 指定另一个 INI 文件路径 |

默认是只读模式。只有显式设置 `YGDRIA_ALLOW_WRITE=true` 并重启服务后，写工具才会注册到 MCP 客户端。建议日常保持只读，仅在确实需要编辑时临时开启。

填写 INI 后可直接启动：

```bash
npm start
```

stdio 的 stdout 专用于 MCP 消息；启动错误只会写到 stderr。本项目不启动 HTTP Server。

## MCP Tools

| Tool | 模式 | ETAPI | 说明 |
| --- | --- | --- | --- |
| `search_notes` | 只读 | `GET /etapi/search` | 搜索笔记；可选 `placementId` 将范围限定为该树节点及其全部子节点 |
| `search_by_tag` | 只读 | `GET /etapi/search?tag=…` | 按精确 tag 搜索；可选 `placementId` 限定子树范围 |
| `list_tags` | 只读 | `GET /etapi/tags` | 列出 ETAPI 可用的全部 tag |
| `list_tree_roots` | 只读 | `GET /etapi/tree/roots` | 分页读取顶层 placement；树导航的唯一入口，不提供完整根树 |
| `get_tree_node` | 只读 | `GET /etapi/tree/nodes/:placementId` | 读取单个 placement 的最小导航信息 |
| `list_tree_children` | 只读 | `GET /etapi/tree/nodes/:placementId/children` | 分页读取直接子节点；依据 `hasChildren` 按需继续展开 |
| `get_tree_subtree` | 只读 | `GET /etapi/tree/nodes/:placementId/subtree` | 在显式深度和节点上限内读取子树 |
| `resolve_tree_nodes` | 只读 | `GET /etapi/tree/resolve?query=...` | 通过标题片段定位候选 placement，再使用其 ID 导航 |
| `get_note` | 只读 | `GET /etapi/notes/:noteId` | 读取正文和 `version`；编辑前必须调用 |
| `create_note` | 需写授权 | `POST /etapi/notes` | 仅在用户明确要求创建时调用；网络异常后不得自动重试 |
| `update_note` | 需写授权 | `PATCH /etapi/notes/:noteId` | 必须传 `expectedVersion`；409 后返回重新读取的最新笔记，不重试旧版本 |
| `edit_content` | 需写授权 | `PATCH /etapi/notes/:noteId/content` | 首选的最小编辑工具：以字面 `oldText`/`newText` 原子修改正文；支持 `expectedMatches` 和 `dryRun` |
| `replace_content` | 需写授权 | `PUT /etapi/notes/:noteId/content` | 以 Markdown 替换全文，并用 `If-Match` 传版本；409 时返回最新笔记供重新评估 |
| `move_placement` | 需写授权 | `PATCH /etapi/placements/:placementId` | 移动 placement，而不是 note |

服务还提供动态 MCP Resource：

```text
ygdria://note/{noteId}
```

读取 Resource 时固定通过 `GET /etapi/notes/:noteId?format=markdown` 返回 Markdown 正文。

## 安全模型

- 默认只注册五个只读工具；写入需要进程级显式授权。
- 只访问 `/etapi/*`。配置 URL 不允许携带路径，因此不能被配置成 `/api/v1/*`。
- 认证请求只发送 `Authorization: Bearer <ETAPI_TOKEN>`，不使用 `X-Ygdria-Local-Token`。
- 不访问 SQLite，不实现删除笔记或清空回收站，不添加缓存、同步或新的认证系统。
- ETAPI 不返回受保护笔记正文时，本服务直接保留权限边界，不尝试获取主密码、设备 Token 或 Local Token。
- `401` 要求停止并重新配置 Token；`403` 停止且不绕过权限；`404` 报告目标不存在；写操作的 `409` 重新读取最新状态；`415` 提示检查 Content-Type；`422` 表示精确编辑无法唯一、完整地定位目标，须重新读取后生成补丁。

## 客户端配置

下面示例中的绝对路径请替换成你的 `dist/index.js` 路径。Windows JSON 路径中的反斜杠需要写成 `\\`。Token 和写权限均从项目根目录的 `ygdria-mcp.ini` 读取，不写入 MCP 客户端配置。

### Claude Desktop

编辑 Claude Desktop 的 MCP 配置并重启客户端：

```json
{
  "mcpServers": {
    "ygdria": {
      "command": "node",
      "args": ["D:\\path\\to\\ygdria-mcp\\dist\\index.js"]
    }
  }
}
```

### Cursor

在项目的 `.cursor/mcp.json` 或 Cursor 的用户级 MCP 配置中添加：

```json
{
  "mcpServers": {
    "ygdria": {
      "command": "node",
      "args": ["D:\\path\\to\\ygdria-mcp\\dist\\index.js"]
    }
  }
}
```

### OpenAI Codex CLI（本地 stdio）

Codex CLI、IDE 扩展和桌面端共用 MCP 配置。可通过 CLI 注册本地 stdio 服务：

```bash
codex mcp add ygdria -- node /absolute/path/to/ygdria-mcp/dist/index.js
```

也可在 Codex 的 `config.toml` 中配置等价的 `[mcp_servers.ygdria]` 项。可参考 [OpenAI Codex MCP 文档](https://developers.openai.com/codex/mcp/)。

### VS Code Codex 扩展

VS Code 中的 Codex 扩展与 Codex CLI 共用 MCP 配置，因此不需要维护另一份 JSON 文件。推荐使用以下任一方式。

方式一：在扩展界面添加。

1. 打开 VS Code 中的 Codex 面板。
2. 点击齿轮菜单，选择 **MCP servers**。
3. 点击 **Add server**。
4. 名称填写 `ygdria`，类型选择 `STDIO`。
5. 如果界面分别提供命令和参数字段，填写：
   - Command：`node`
   - Arguments：`D:\path\to\ygdria-mcp\dist\index.js`
6. 如果界面只提供一个命令字段，填写：

   ```text
   node "D:\path\to\ygdria-mcp\dist\index.js"
   ```

7. 保存，然后选择 **Restart extension**。

这里不要填写 `YGDRIA_ETAPI_TOKEN`。Token 继续保存在项目根目录的 `ygdria-mcp.ini` 中。

方式二：编辑 Codex 配置文件。全局配置默认位于 `C:\Users\<用户名>\.codex\config.toml`；也可以在受信任的项目中使用 `.codex/config.toml`：

```toml
[mcp_servers.ygdria]
command = "node"
args = ["D:\\path\\to\\ygdria-mcp\\dist\\index.js"]
cwd = "D:\\path\\to\\ygdria-mcp"
enabled = true
default_tools_approval_mode = "writes"
```

`default_tools_approval_mode = "writes"` 会让 Codex 对非只读工具请求确认；Ygdria MCP 本身仍以 `ygdria-mcp.ini` 中的 `allowWrite` 为最终写入开关。修改配置后重启 Codex 扩展。在 VS Code 集成终端运行以下命令可以检查是否已注册：

```powershell
codex mcp list
```

官方说明见 [Codex MCP：IDE extension 配置](https://developers.openai.com/codex/mcp/#configure-in-the-ide-extension)。

### ChatGPT Web

ChatGPT Web 的自定义 MCP App 连接远程 MCP 服务，不能直接启动本地 stdio 进程。因此本项目遵守“不实现 HTTP Server”的要求，**不能直接粘贴到 ChatGPT Web 的 App endpoint 中**。若账户和组织已提供 Secure MCP Tunnel，可用它把本地服务安全接入；否则需要一个独立、受控的远程传输桥接层（不属于本项目范围）。参见 [OpenAI 关于 ChatGPT Developer Mode 与 MCP Apps 的说明](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)。

## 开发与验证

```bash
npm run typecheck
npm test
```

测试覆盖只读默认值、禁止 `/api/v1` 风格 base URL、Bearer 认证、不发送 Local Token、受保护搜索结果过滤、Markdown `If-Match`，以及创建请求网络失败不重试。
