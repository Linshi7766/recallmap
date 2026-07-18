# Recall 当前发现与决策

## Requirements
- 黑客松类别：Education。
- 评委必须能通过公网 HTTPS 访问产品。
- 正式体验应由服务器端 GPT-5.6 提供，不能只依赖固定 fallback。
- 不得泄露 SSH 私钥、密码或 `OPENAI_API_KEY`。

## Deployment Findings
- 以下状态来自用户 2026-07-18 的部署汇报，尚未由本会话独立复验。
- Azure VM 已完成 SSH 密钥配置。
- Node.js 版本为 20.20.2，满足项目要求 `>=20.19.0`。
- 代码已上传，`npm ci` 与 production build 已完成。
- systemd 服务为 `active (running)`，并已启用开机自启。
- Nginx 已反向代理到 `127.0.0.1:3000`。
- 公网域名为 https://recall-app.duckdns.org 。
- Let's Encrypt 证书有效期至 2026-10-16。
- `OPENAI_API_KEY` 尚未设置；目前只有匹配内置脚本的 fallback 路径可用。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 下一优先级是设置 API Key 并做 live 验收 | 基础部署已完成，真实模型路径是当前唯一关键功能缺口 |
| 验收必须包含非内置示例材料 | 可区分 live GPT-5.6 与固定 fallback |
| 不在文档中记录密钥值 | 降低凭据泄露风险 |

## Resources
- 项目说明：`D:\UniFiles\ProjectRecall\README.md`
- 公网入口：https://recall-app.duckdns.org
- 历史交接：`D:\UniFiles\ProjectRecall\进度管理\Recall-进度交接.md`

