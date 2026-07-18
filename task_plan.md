# Recall 收尾计划

## Goal
让 Recall 的公网演示达到可供黑客松评委稳定访问、完整体验 GPT-5.6 主流程并可提交的状态。

## Current Phase
Phase 3：修复本地 MiMo 集成构建门禁，并准备生产环境凭据

## Phases

### Phase 1：产品开发
- [x] 完成 Recall Next.js 应用与 README
- [x] 通过 lint、单元/组件测试、E2E 和 production build
- **Status:** complete

### Phase 2：Azure 部署
- [x] SSH、Node.js、依赖安装和 production build
- [x] systemd、Nginx、HTTPS、域名和开机自启
- **Status:** complete（依据用户 2026-07-18 汇报，尚待独立复验）

### Phase 3：启用完整 AI 主流程
- [x] 完成本地 MiMo provider 代码集成：仅当未配置 OpenAI 时选择 `mimo-v2.5`；两者同时存在时 OpenAI 优先。
- [ ] 修复 `npm run build` 的 TypeScript 阻断（`src/lib/ai/provider.ts:22` 中 `process.env` 与 `ProviderEnvironment` 不兼容），并重新运行完整本地门禁。
- [ ] 在服务器安全设置 `MIMO_API_KEY`（或继续使用 `OPENAI_API_KEY`）；不得把任何密钥写入仓库、命令参数、截图或聊天记录。
- [ ] 取得准确的 systemd unit 名称，使用 root 可读环境文件和 drop-in 注入密钥后重启该服务。
- [ ] 通过 https://recall-app.duckdns.org 验证任意非内置示例材料走 live MiMo；不得将 fallback 视为 live 验收。
- **Status:** blocked（2026-07-18 本地 build 失败；服务器配置和 live MiMo 验收均未执行）

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
1. 生产环境的 `MIMO_API_KEY`（或 `OPENAI_API_KEY`）何时安全配置？
2. 准确的 systemd unit 名称是什么，以便安全地创建 drop-in 并重启正确服务？
3. 公网 live MiMo 主流程是否已经通过非内置材料完整跑通？
4. Demo 视频、代码仓库和 Devpost 提交材料是否已经完成？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 使用 Azure VM + Nginx + systemd | 当前部署已经完成并具有 HTTPS 公网入口 |
| fallback 不视为完整上线 | 固定 fallback 只能保障演示路径，不能证明任意材料的 GPT-5.6 功能 |
| 密钥只在服务器端注入 | 防止进入 Git、浏览器包、日志或聊天记录 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 初次 SSH 返回 `Permission denied (publickey)` | 1 | 后续已完成 SSH 密钥配置 |
| 当前网络不稳定，原会话无法继续部署 | 1 | 将 Azure 部署交接给其他 agent，现已完成基础部署 |

