# AGENTS.md

## 專案概述
Flower Life 花卉電商示範專案 — Node.js (Express) + SQLite (better-sqlite3) + EJS + Vue 3 + Tailwind CSS + Vitest。

## 常用指令
- `npm install`：安裝依賴
- `npm run dev:server`：啟動後端伺服器（預設 `:3001`）
- `npm run dev:css`：啟動 Tailwind CSS watch
- `npm run css:build`：建置壓縮版 CSS（輸出 `public/css/output.css`）
- `npm start`：先 build CSS 再啟動 server
- `npm test`：執行 Vitest API 測試（固定檔案順序、非平行）
- `npm run openapi`：由 `src/routes/*.js` 註解產生 `openapi.json`

## 關鍵規則
- 所有 API 採統一 envelope：`{ data, error, message }`；成功時 `error=null`，失敗時 `data=null`。
- JWT 必須使用 `HS256`，並由 `JWT_SECRET` 驗證；`/api/cart` 另支援 `X-Session-Id` 的訪客模式。
- 後台路由一律套用 `authMiddleware` + `adminMiddleware`，不可僅以前端頁面保護取代後端授權。
- 訂單建立必須維持交易一致性：建立訂單、寫入訂單明細、扣庫存、清空購物車需在同一 transaction。
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`，並同步更新 `docs/FEATURES.md` 與 `docs/CHANGELOG.md`。

## 詳細文件
- `./docs/README.md` — 項目介紹與快速開始
- `./docs/ARCHITECTURE.md` — 架構、目錄結構、資料流
- `./docs/DEVELOPMENT.md` — 開發規範、命名規則
- `./docs/FEATURES.md` — 功能列表與完成狀態
- `./docs/TESTING.md` — 測試規範與指南
- `./docs/CHANGELOG.md` — 更新日誌
