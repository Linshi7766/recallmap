# Recall 收尾计划

## Goal
让 Recall 的公网演示达到可供黑客松评委稳定访问、透明体验已选 live AI provider 主流程并可提交的状态。

## Current Phase
Phase 3：MiMo no-reasoning 受控 HTTP 验收已在 release `2fde678` 通过；browser UI repair-flow 仍未验证

## Phases

### Phase 1：产品开发
- [x] 完成 Recall Next.js 应用与 README
- [x] 通过 lint、单元/组件测试、E2E 和 production build（这是 `f664d1e` 时期的原始产品基线；MiMo 集成后的新鲜验证单独记录在 Phase 3）
- **Status:** complete

### Phase 2：Azure 部署
- [x] SSH、Node.js、依赖安装和 production build
- [x] systemd、Nginx、HTTPS、域名和开机自启
- **Status:** complete（依据用户 2026-07-18 汇报，尚待独立复验）

### Phase 3：启用完整 AI 主流程
- [x] 完成本地 MiMo provider 代码集成：仅当未配置 OpenAI 时选择 `mimo-v2.5`；两者同时存在时 OpenAI 优先。
- [x] 以 `5885fbe` 修复 MiMo Responses 兼容路径：`json_object`、raw `output_text` JSON 解析、本地 Zod/domain validation 与一次安全 repair retry；OpenAI strict parse 保持原行为。
- [x] 首页强制动态渲染；新鲜 production build 路由表显示 `ƒ /`，运行时环境决定 provider label。
- [x] 在当前 HEAD 新鲜通过 lint、169 项 Vitest、6 项获批非沙箱 Playwright E2E 和 production build。
- [x] 使用官方 npm registry 完成生产依赖审计；确认 2 个 moderate（Next → PostCSS）且 `No fix available`，保留为已知上游风险，不修改依赖。
- [x] 在服务器安全设置 `MIMO_API_KEY`；密钥值未写入仓库、命令参数、截图或聊天记录。
- [x] 确认 systemd unit 为 `recall.service`，通过权限为 `0600` 的 `.env.production` 注入密钥并重启服务。
- [x] 通过 https://recall-app.duckdns.org 验证任意非内置示例材料走 live MiMo；响应为 `fallback=false`。
- **Status:** complete

### Phase 4：公网验收
- [ ] 检查 https://recall-app.duckdns.org 可访问且证书有效
- [ ] 跑通内置示例和一条非 fallback 的真实模型流程
- [ ] 验证服务重启、服务器重启后的自动恢复
- [ ] 检查移动端、错误提示和 API Key 不泄露
- **Status:** pending

### Phase 5：比赛提交
- [ ] 完成并上传小于 3 分钟的英文 Demo 视频
- [ ] 准备公开代码仓库或按规则共享私有仓库
- [ ] 填写 Devpost 项目材料、Codex Session ID 和在线 Demo URL
- [ ] 在截止前完成最终提交并保留提交成功证据
- **Status:** pending

## Key Questions
1. 准确的 systemd unit 名称是什么，以便安全地创建 drop-in 并重启正确服务？
2. 生产环境的 `MIMO_API_KEY` 何时通过 root 可读环境文件安全配置？
3. 公网 live MiMo 主流程是否已经通过非内置材料完整跑通？
4. Demo 视频、代码仓库和 Devpost 提交材料是否已经完成？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 使用 Azure VM + Nginx + systemd | 当前部署已经完成并具有 HTTPS 公网入口 |
| fallback 不视为完整上线 | 固定 fallback 只能保障演示路径，不能证明任意材料的 live provider 功能 |
| 密钥只在服务器端注入 | 防止进入 Git、浏览器包、日志或聊天记录 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 初次 SSH 返回 `Permission denied (publickey)` | 1 | 后续已完成 SSH 密钥配置 |
| 当前网络不稳定，原会话无法继续部署 | 1 | 将 Azure 部署交接给其他 agent，现已完成基础部署 |
| MiMo 初次 production build 在 `provider.ts:22` 类型检查失败 | 1 | `dc163c4` 修复环境对象结构类型；当前 HEAD build exit 0 |
| 沙箱内 Playwright 6 项用例结束后无法回收 Windows webServer | 1 | 获批非沙箱运行自然退出，6/6 通过；未将沙箱超时视为项目失败 |
| 默认镜像不实现 npm audit endpoint | 1 | 改用官方 registry 验证：2 moderate，No fix available |
| final-fix 首次 build 在 `client.ts` 拒绝 raw response 类型 | 1 | 将 refusal helper 参数收窄为它实际读取的可选 `output`；重跑 build exit 0 且首页为 dynamic |

## Production completion update — 2026-07-18
- [x] Identified the exact systemd unit: `recall.service`.
- [x] Deployed commit `1d502cb` with a staged production build and health-checked directory switch.
- [x] Configured `MIMO_API_KEY` only in `/home/azureuser/recall/.env.production` without exposing the credential value.
- [x] Verified https://recall-app.duckdns.org returns HTTP 200 and displays `MiMo V2.5`.
- [x] Verified a novel, non-demo request returns `ok=true` and `fallback=false`.
- **Phase 3 status:** complete.
- **Next phase:** complete the remaining full UI/reboot acceptance, then prepare submission assets, demo recording, and the Devpost entry.

## Task 4 rollback-safe deployment — 2026-07-18
- [x] Created a tracked-only archive and found no `.env.production`, `.env.local`, `node_modules`, `.next`, or `.git` entries.
- [x] Preflighted clear release/backup paths; uploaded and built the staged release while production remained online.
- [x] Ran the prescribed automatic-rollback switch; it reported `deploy-ok`. The prior release remains retained at `/home/azureuser/recall-backup-before-timeout-20260718`.
- [x] Verified `recall.service` active, local health reachable, public HTTP 200, and provider label `MiMo V2.5`.
- [x] **Superseded historical result:** novel `diagnose` acceptance returned HTTP 503 after the bounded acceptance process (119.9 seconds). The preceding novel `generate_challenge` was HTTP 200 with `ok=true`, `fallback=false`. This history is retained and superseded by the final no-reasoning controlled acceptance below.
- [ ] **Unverified:** required browser repair flow; no browser surface was available in this execution environment.
- **Task 4 status:** historical record superseded; current controlled HTTP acceptance is passed, while browser UI repair-flow verification remains unverified.

## Final MiMo no-reasoning controlled acceptance — 2026-07-18
- [x] Release `2fde678` completed the controlled HTTP `generate` request with HTTP 200 in 4.157 seconds.
- [x] The controlled HTTP `diagnose` request completed with HTTP 200 in 11.803 seconds, `fallback=false`, three valid reasoning nodes, and a probe.
- [x] Controlled HTTP acceptance passed; the current tracker state is not blocked.
- [ ] Browser UI repair-flow verification is unverified and is not claimed by this acceptance.

