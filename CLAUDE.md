# 專案工作規則 (Traffic Lane Defender)

> 每次開啟新工作時請先閱讀本檔。Claude Code 會在 session 開始自動載入。

## 1. 完成工作後自動提交 + 推播

只要完成一項工作（功能、修 bug、調整、重構、文件更新…等），**不必再問使用者**，
請直接：

1. `git status` 確認改動範圍
2. `git add <具體檔案>`（避免 `git add -A`／`git add .`，以免帶到敏感檔）
3. `git commit -m "..."` 建立 commit
4. `git push` 推到 `origin/main`
5. 回報 commit hash 與推播結果

### 例外（這些情況要先停下來問使用者）

- 改動裡有可能含密鑰、Token、`.env`、憑證檔
- 工作只完成一半、處於壞掉／半成品狀態
- 牽涉破壞性操作：`--force` push、刪分支、改寫歷史、刪檔
- 修改 `main` 以外的分支，或要建立新分支
- 使用者明確要求「先別推」、「先讓我看」

## 2. Commit message 規範

跟隨既有風格：

- **英文**、現在式祈使句（imperative mood）
- 標題行 ≤ 60 字，不加句號
- 動詞起頭：`Add`, `Fix`, `Update`, `Remove`, `Refactor`, `Soften`, `Remap`…
- 需要補充細節時，標題後空一行再寫 body（繁中或英文都可）
- 結尾固定加上 `Co-Authored-By: Claude ...`

範例：

```
Add lane-mode selector to start menu

Replace the implicit per-game lane rotation with an explicit
picker (auto / 2 / 3 / 4 / 5 lanes) on the pre-game screen.
```

## 3. 推播前的最低驗證

改到 `index.html` 的遊戲邏輯或 UI 時，盡量先用 Claude Preview 跑一次
（`.claude/launch.json` 已設定 `main-static`）：

- 啟動：`mcp__Claude_Preview__preview_start` → `name: main-static`
- 快速跑一次相關互動，確認 console 沒有 error
- 沒問題再 commit + push

純文件、純註解、純樣式微調可以略過驗證直接推。

## 4. 不要做的事

- 不要主動建立 README、設計文件、心得 markdown，除非使用者要求
- 不要動 `.git/config`、不要改 commit author
- 不要 `--no-verify` 跳過 hook
- 不要對 `main` 做 force push
- 不要把 `.claude/worktrees/` 內容當成主程式來修

## 5. 專案結構速查

- `index.html` — 單檔遊戲（HTML + Tailwind CDN + JS，3000+ 行）
- `assets/cars/`、`assets/sounds/`、`assets/music/` — 美術與音效
- `scripts/` — 音效合成工具與靜態伺服器
- `service-worker.js`、`manifest.webmanifest` — PWA 支援
- `.claude/launch.json` — Preview 用的 `main-static` (port 8766)
