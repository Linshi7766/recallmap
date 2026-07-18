# Recall Progress Log

## Session: 2026-07-18

### 进度重新跟踪
- **Status:** complete
- 根据用户提供的最新 Azure 状态建立 `task_plan.md`、`findings.md` 和本文件。
- 更新历史交接文档顶部与核心现状，明确旧开发计划不再是当前执行依据。
- 未修改应用代码、配置密钥或执行服务器操作。

### Phase 1：代码开发
- **Status:** complete
- 已完成 Next.js 应用、README 和测试覆盖。
- 历史基线（`f664d1e` 时期）验证结果：lint 通过、155/155 测试通过、6/6 E2E 通过、production build 通过。该结果不代表后续 MiMo 改动；当前 MiMo HEAD 的新鲜验证见下方 Task 5。
- 当前已知提交：`f664d1e`。

### Phase 2：Azure 部署
- **Status:** complete（用户报告，待独立复验）
- SSH 密钥配置完成。
- Node.js 20.20.2 安装完成。
- 代码上传、`npm ci`、production build 完成。
- systemd 服务 active 且 enabled。
- Nginx 转发到 `127.0.0.1:3000`。
- DuckDNS 与 Let's Encrypt HTTPS 已配置。

### Phase 3：完整 AI 主流程
- **Status:** in_progress
- 本地 MiMo provider 代码集成已提交：`OPENAI_API_KEY` 存在时 GPT-5.6 优先；否则 `MIMO_API_KEY` 选择 MiMo V2.5。
- `5885fbe` 已修复 MiMo JSON object/raw output path 与首页 runtime provider label；当前 HEAD 的 lint、169 项 Vitest、dynamic production build 和 6 项获批非沙箱 E2E 已新鲜通过。
- 官方 npm audit 已验证 2 个 moderate（Next → PostCSS），`No fix available`；保留为已知上游风险且未改动依赖。
- 服务器 `MIMO_API_KEY` 仍 pending；本会话未连接或修改 Azure。需先确认精确的 systemd unit 名称，再通过 root 可读环境文件和 systemd drop-in 安全注入密钥。
- live non-demo MiMo 验收仍 pending；不得将内置 fallback 或自动化 mock 视为生产验证。

### Task 5：最终审查修复与门禁（2026-07-18）
- **Status:** final-fix local verification complete；server handoff pending
- RED（核心）：`npx vitest run tests/ai/client.test.ts tests/components/recall-app.test.tsx` exit 1，4 failed / 61 passed；失败精确命中 MiMo 仍走 `responses.parse` 的 3 项行为和缺失 `dynamic` export。首次实现后再跑为 exit 1，2 failed / 63 passed，定位 malformed JSON 尚未进入 repair retry。
- GREEN（核心）：同一命令 exit 0，2 files / 65 tests；README hygiene 先 RED（exit 1，1 failed / 4 passed），再 GREEN（exit 0，5/5）。
- focused AI/client/provider：exit 0，3 files / 57 tests；focused component/hygiene：exit 0，2 files / 46 tests。
- `npm run lint`：exit 0，ESLint 无报告错误。
- `npm test`：exit 0，Vitest 11 个测试文件、169 项测试通过、0 失败。
- `npm run build`：首次 exit 1（raw response refusal helper 类型过窄）；最小修复后 exit 0，路由表明确首页 `ƒ /` 为 dynamic。
- `npm run test:e2e`：获批非沙箱运行 exit 0，6/6 Playwright Chromium 用例通过并自然退出。
- `npm audit --omit=dev --registry=https://registry.npmjs.org`：exit 1；官方 registry 验证 2 moderate（Next → PostCSS）且 `No fix available`。审计已验证，但风险仍未解决。
- 完整范围 `f543c5e..HEAD` 明确包含 `.env.example`、README、三份进度文档、5 个 `src` 文件和 5 个 `tests` 文件；完整逐文件列表见 `findings.md`。`git diff --check f543c5e..HEAD` exit 0；未发现真实凭据值。

## Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| systemd 状态 | active | 用户报告 active (running) | ⚠️ 待复验 |
| Nginx 转发 | 127.0.0.1:3000 可用 | 用户报告已配置 | ⚠️ 待复验 |
| HTTPS | 证书有效 | 用户报告有效至 2026-10-16 | ⚠️ 待复验 |
| 开机自启 | enabled | 用户报告 enabled | ⚠️ 待复验 |
| Live MiMo | 任意非内置材料可分析 | 服务器 `MIMO_API_KEY`、准确 unit 和公网验收均 pending | ❌ 未完成 |
| lint（Task 5） | exit 0 | exit 0 | ✅ 通过 |
| unit/component（Task 5） | 0 失败 | 11 files / 169 tests 通过 | ✅ 通过 |
| E2E（Task 5） | 命令 exit 0 | 6/6 passed，自然退出 0 | ✅ 通过 |
| production build（Task 5） | exit 0，首页 dynamic | `ƒ /`，exit 0 | ✅ 通过 |
| production audit（Task 5） | 记录官方结果 | 2 moderate，No fix available，exit 1 | ⚠️ 已验证上游风险 |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 3：本地 MiMo 验证完成；服务器配置尚未开始 |
| Where am I going? | 先确认 systemd unit、配置服务器 `MIMO_API_KEY`，再做 live non-demo 公网验收 |
| What's the goal? | 给评委提供稳定、透明标注 provider 的真实学习体验，而非仅依赖 fallback |
| What have I learned? | 本地 runtime 已通过全部功能门禁；仍有 2 个无可用修复的 moderate 上游漏洞，且服务器凭据、服务重启和真实 MiMo Responses 兼容性均未验证 |
| What have I done? | 完成 MiMo 集成、全套本地门禁、Azure 部署与 live non-demo 公网验收 |

## Production MiMo verification — 2026-07-18
- **Status:** complete
- Deployed commit `1d502cb` to `/home/azureuser/recall`; previous release retained at `/home/azureuser/recall-backup-before-mimo-1d502cb`.
- Confirmed `recall.service` is active and the public HTTPS homepage returns HTTP 200.
- Configured one server-side `MIMO_API_KEY` entry without printing or storing the credential value in the repository.
- Public runtime label verified as `MiMo V2.5`.
- Live non-demo `generate_challenge` acceptance passed: `ok=true`, `fallback=false`, with a new concept, a 271-character prompt, and 3 evidence passages.
