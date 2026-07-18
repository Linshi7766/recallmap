# Recall 当前发现与决策

## Requirements
- 黑客松类别：Education。
- 评委必须能通过公网 HTTPS 访问产品。
- 正式体验应由服务器端已选 live provider 提供，不能只依赖固定 fallback。
- 不得泄露 SSH 私钥、密码、`OPENAI_API_KEY` 或 `MIMO_API_KEY`。

## Deployment Findings
- 以下状态来自用户 2026-07-18 的部署汇报，尚未由本会话独立复验。
- Azure VM 已完成 SSH 密钥配置。
- Node.js 版本为 20.20.2，满足项目要求 `>=20.19.0`。
- 代码已上传，`npm ci` 与 production build 已完成。
- systemd 服务为 `active (running)`，并已启用开机自启。
- Nginx 已反向代理到 `127.0.0.1:3000`。
- 公网域名为 https://recall-app.duckdns.org 。
- Let's Encrypt 证书有效期至 2026-10-16。
- `OPENAI_API_KEY` 尚未设置；本会话没有连接或修改 Azure，`MIMO_API_KEY` 是否已在服务器设置也未经验证。
- 不得在服务器更新完成且任意非内置材料成功返回前，声称 Azure 部署正在使用 MiMo。

## MiMo 本地集成验证（2026-07-18）
- Provider 优先级：已提交的本地实现先选择 `OPENAI_API_KEY` 的 GPT-5.6；仅当它未配置时才选择 `MIMO_API_KEY` 的 `mimo-v2.5`。两者都缺失时只允许受限的内置 demo fallback。
- 自动化测试使用 stubbed 环境变量、fixture 或拦截的 `/api/learn` 请求；它们没有调用 OpenAI 或 MiMo 的真实 API，不能证明凭据、网络或生产 Responses 兼容性。
- 新鲜本地结果：`npm run lint` 退出 0；`npm test` 为 11 个文件、165 项通过；`npm run test:e2e` 显示 6/6 用例 `ok` 但进程未退出并在 120 秒超时（exit 124）；`npm run build` 退出 1，TypeScript 报告 `src/lib/ai/provider.ts:22` 的 `process.env` 不兼容；`npm audit --omit=dev` 退出 1，因为当前 registry 的 security endpoint 返回 `NOT_IMPLEMENTED`，漏洞状态未验证。
- 已检查 MiMo 提交范围（`HEAD~5..HEAD`）：仅 `.env.example`、README、`src` 和 `tests` 下的计划内文件；没有实际凭据值。当前 worktree 在文档更新前无未提交实现变更，`git diff --check` 退出 0。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 下一优先级是先修复 build，再设置 API Key 并做 live 验收 | 本地生产构建失败时不能部署；真实模型路径仍未经生产验证 |
| 验收必须包含非内置示例材料 | 可区分 live MiMo（或 OpenAI）与固定 fallback |
| OpenAI 优先于 MiMo | 保持已有 GPT-5.6 配置的行为；MiMo 只作为未配置 OpenAI 时的可选 provider |
| 不在文档中记录密钥值 | 降低凭据泄露风险 |

## Resources
- 项目说明：`D:\UniFiles\ProjectRecall\README.md`
- 公网入口：https://recall-app.duckdns.org
- 历史交接：`D:\UniFiles\ProjectRecall\进度管理\Recall-进度交接.md`

