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
- MiMo 请求使用 `text.format: { type: "json_object" }` 与 `responses.create`；精确 Zod JSON Schema 只进入可信 instructions，lesson/user content 仍留在 `input`。raw `output_text` 经 `JSON.parse` 后走原有 Zod/domain validation；malformed JSON 使用同一条一次 repair retry，反馈和最终错误均不包含 raw output。OpenAI 继续使用 `zodTextFormat` 与 `responses.parse`。
- 自动化测试使用 stubbed 环境变量、fixture 或拦截的 `/api/learn` 请求；它们没有调用 OpenAI 或 MiMo 的真实 API，不能证明凭据、网络或生产 Responses 兼容性。
- 当前 HEAD 新鲜结果：`npm run lint` exit 0；`npm test` exit 0（11 files / 169 tests）；`npm run build` exit 0（TypeScript 完成，路由表为 `ƒ /`、`○ /_not-found`、`ƒ /api/learn`）；获批非沙箱 `npm run test:e2e` 自然退出 0（6/6 passed）。
- `npm audit --omit=dev --registry=https://registry.npmjs.org` 已由官方 registry 验证：exit 1，2 个 moderate，链路为 Next → PostCSS，`No fix available`。这是已知未解决的上游风险；本任务不修改依赖。
- 完整 MiMo 工作范围使用明确基线 `f543c5e..HEAD`（最终文档提交后仍为同一文件集合）：`.env.example`、`README.md`、`task_plan.md`、`findings.md`、`progress.md`、`src/app/globals.css`、`src/app/page.tsx`、`src/components/recall/recall-app.tsx`、`src/lib/ai/client.ts`、`src/lib/ai/provider.ts`、`tests/ai/client.test.ts`、`tests/ai/operations.test.ts`、`tests/ai/provider.test.ts`、`tests/components/recall-app.test.tsx`、`tests/repository/hygiene.test.ts`。`git diff --check f543c5e..HEAD` exit 0；完整 diff 未发现真实凭据值，`.env.example` 的两项赋值均为空，测试中的 key 文本仅为非生产 sentinel。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 下一优先级是取得 unit 名称、设置服务器 MiMo key 并做 live 验收 | 当前 HEAD 的本地兼容与行为门禁已通过；真实模型路径仍未经生产验证 |
| 验收必须包含非内置示例材料 | 可区分 live MiMo（或 OpenAI）与固定 fallback |
| OpenAI 优先于 MiMo | 保持已有 GPT-5.6 配置的行为；MiMo 只作为未配置 OpenAI 时的可选 provider |
| 不在文档中记录密钥值 | 降低凭据泄露风险 |

## Resources
- 项目说明：`D:\UniFiles\ProjectRecall\README.md`
- 公网入口：https://recall-app.duckdns.org
- 历史交接：`D:\UniFiles\ProjectRecall\进度管理\Recall-进度交接.md`

## Verified production findings — 2026-07-18
- Azure service identity is `recall.service`, running as `azureuser` from `/home/azureuser/recall`.
- The production environment file is `/home/azureuser/recall/.env.production`; only variable names and non-secret metadata were inspected.
- Commit `1d502cb` built successfully on the VM and was switched into production with the prior release retained for rollback.
- Public HTTPS returned 200 and server-rendered `AI provider: MiMo V2.5`.
- A novel retrieval-practice lesson produced a live challenge with `fallback=false`, proving the request used MiMo rather than the exact demo fixture.

