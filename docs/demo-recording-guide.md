# RecallMap demo recording guide / RecallMap 演示录制指南

Use this guide with `docs/demo-script.md`. Record the product clips first, then record the English voice-over while reading only the **English narration** blocks.

## Before recording / 录制前

- Set the canvas and screen recording to **1920×1080**, 16:9, at 30 fps or higher.
- Set browser zoom to roughly **110–125%** so the reasoning map remains readable.
- Turn off desktop and browser notifications. Close chat, email, Azure, and unrelated tabs.
- Hide the bookmarks bar, personal profile icon where possible, and browser autofill suggestions.
- Open only these public pages in advance:
  - `https://recall-app.duckdns.org`
  - `https://github.com/Linshi7766/recallmap`
- Put the two prepared answers below into a plain clipboard manager or temporary local note that will never appear in the recording.
- Test the microphone at a steady distance. Record in a quiet room and leave one second of silence before each narration take.
- Complete one private rehearsal of the full learning flow before recording clips.

## Exact paste text / 精确粘贴文本

### First explanation / 第一次解释

Paste this into **Your explanation**:

```text
If two variables consistently move together, one probably causes the other unless the data has an error.
```

### Revised explanation / 修订后的解释

Paste this into the repair text area:

```text
Correlation shows that variables move together, but it does not reveal why. The association may come from direct causation, reverse causation, a common cause such as temperature, selection bias, or chance, so additional evidence is required.
```

Do not improvise these answers during the final take. They are the repository's tested demo inputs and produce the intended misconception-to-repair story.

## Shot list / 分镜操作表

| Final time | Browser action / 浏览器操作 | Recording note / 录制提示 |
| --- | --- | --- |
| 0:00–0:15 | Open the public RecallMap start screen. / 打开 RecallMap 公网页面首页。 | Hold for two seconds with the brand, headline, and start button visible. / 保持两秒，让品牌、标题和按钮清晰可见。 |
| 0:15–0:35 | Click **Start sample lesson**. / 点击 **Start sample lesson**。 | Stop scrolling when the correlation-and-causation prompt is centered. / 让相关与因果题目位于画面中央。 |
| 0:35–0:55 | Paste the first explanation and click **Reveal my blind spot**. / 粘贴第一次解释并点击分析按钮。 | End this raw clip immediately after the click; do not record the full wait. / 点击后结束原始片段，不录完整等待。 |
| 0:55–1:30 | In a successful completed take, slowly show the reasoning map, priority gap, evidence, and focused question. / 在成功结果画面中依次展示推理图、关键断点、证据和聚焦问题。 | Insert `Live analysis — wait removed` for about 1.5 seconds at the cut. Do not speed-scroll. / 剪切处显示等待已移除的提示约 1.5 秒，不要快速滚动。 |
| 1:30–1:55 | Click **Work through this challenge**, paste the revision, then click **Check my repaired understanding**. / 点击进入挑战，粘贴修订解释，再点击验证按钮。 | Keep the cursor away from text while the narration describes the revision. / 旁白期间不要用鼠标遮挡文字。 |
| 1:55–2:20 | Cut to a successful result, then show the green repaired node and Before/After card. / 切换到成功结果，展示绿色节点和前后对比。 | Show `Live analysis — wait removed` again at the cut. Pause long enough to read both sides. / 再次显示等待移除提示，并给前后对比留出阅读时间。 |
| 2:20–2:40 | Switch to the public GitHub repository, briefly show `tests/` and the README provider section. / 切换到公开 GitHub，简要展示测试目录和 README 的模型披露。 | Use the public webpage only. Never show a local terminal, filesystem path, Azure portal, or secret. / 只展示公开网页，不展示终端、本地路径、Azure 或密钥。 |
| 2:40–2:50 | Return to the repaired reasoning map or RecallMap header. / 回到修复后的推理图或品牌页头。 | End on a clean frame with the RecallMap brand visible for one second after the final line. / 最后一句结束后保留品牌画面一秒。 |

## Editing workflow / 剪辑流程

1. Record each of the eight screen segments as a separate clip. Keep the original unedited files.
2. Record the English narration separately, one section at a time. Speak naturally at roughly 115–125 words per minute.
3. Place the narration first on the timeline, then trim the product clips to match it.
4. Remove the live-model waiting portions, but keep the real click before each request and the real successful result after it.
5. At each analysis cut, display `Live analysis — wait removed` for roughly 1.5 seconds.
6. Generate English subtitles, then manually correct `RecallMap`, `MiMo V2.5`, `GPT-5.6`, `Responses API`, `Codex`, and `fallback=false`.
7. Do not add Chinese subtitles to the final competition cut; the Chinese text is a rehearsal reference.
8. Use only subtle cuts and cursor highlights. Avoid decorative transitions, background music that competes with speech, or artificial typing sounds.
9. Watch once without sound to confirm the visual story is understandable, then once with eyes closed to confirm the narration is understandable.

## Privacy and accuracy check / 隐私与准确性检查

Before export, pause on every browser switch and inspect the full frame:

- **No API keys, Azure account details, or personal email**.
- No browser notifications, bookmarks, unrelated tabs, download history, or profile menu.
- No local terminal paths, SSH commands, IP addresses, environment files, or clipboard history.
- The public app visibly says `RECALLMAP` and `MiMo V2.5`.
- The narration does not claim that the public deployment currently runs GPT-5.6.
- The narration clearly says Codex was the development tool, not the runtime tutor.
- Both model-result screens come from real successful requests; no result is fabricated.

## Export and upload check / 导出与上传检查

- Export MP4 using H.264 video and AAC audio at 1920×1080, 16:9.
- Keep the final duration at or below **2:50**; never exceed **3:00**.
- Confirm speech is clear on both headphones and laptop speakers, with no clipping or long silent gaps.
- Confirm English subtitles match the spoken narration and remain inside the safe title area.
- Watch the exported file from beginning to end before uploading.
- Upload to YouTube with visibility set to **Public** or the exact visibility required by the submission form.
- Suggested title: `RecallMap — Find the Missing Link in What You Think You Know`.
- Put the public app and GitHub links in the description:
  - `https://recall-app.duckdns.org`
  - `https://github.com/Linshi7766/recallmap`
- Open the uploaded video in a logged-out or private browser window and verify video, audio, subtitles, description links, visibility, and duration.
