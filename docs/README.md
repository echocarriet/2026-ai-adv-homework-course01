# Flower Life 文件總覽

本目錄為花卉電商專案的工程文件，內容直接對應目前程式碼（`app.js`、`src/routes/*`、`src/middleware/*`、`src/database.js`、`public/js/*`、`tests/*`）。

## 專案介紹
Flower Life 是一個具備前後台的電商示範系統，支援：
- 前台商品瀏覽、商品詳情、加入購物車（訪客/會員雙模式）
- 會員註冊登入、結帳建立訂單、模擬付款、查詢訂單
- 後台商品 CRUD 與後台訂單查詢（管理員權限）

## 技術棧
- Runtime: Node.js
- Backend: Express 4
- DB: SQLite + better-sqlite3
- Auth: JWT (`jsonwebtoken`) + bcrypt
- Template: EJS
- Frontend: Vue 3 (CDN 版) + Vanilla JS modules in `public/js`
- Styling: Tailwind CSS v4 (`@tailwindcss/cli`)
- Testing: Vitest + Supertest
- API Spec: swagger-jsdoc（由 JSDoc `@openapi` 產生）

## 快速開始
1. 複製環境變數檔
```bash
cp .env.example .env
```

2. 安裝依賴
```bash
npm install
```

3. 啟動 CSS watch（開發時建議）
```bash
npm run dev:css
```

4. 啟動伺服器（另一個終端）
```bash
npm run dev:server
```

5. 開啟網站
- 前台：`http://localhost:3001`
- 後台：`http://localhost:3001/admin/products`

## 一鍵啟動（非 watch）
```bash
npm start
```

## 常用指令表
| 指令 | 用途 |
|---|---|
| `npm run dev:server` | 啟動 Express server |
| `npm run dev:css` | Tailwind 開發監看 |
| `npm run css:build` | 產生壓縮 CSS |
| `npm test` | 執行 API 測試 |
| `npm run openapi` | 產生 `openapi.json` |

## 預設測試管理員帳密
- Email: `admin@hexschool.com`
- Password: `12345678`
- 實際由 `src/database.js` seed，且可由 `.env` `ADMIN_EMAIL`、`ADMIN_PASSWORD` 覆寫。

## 文件索引
| 文件 | 重點 |
|---|---|
| `./ARCHITECTURE.md` | 系統架構、路由總覽、資料流、DB schema |
| `./DEVELOPMENT.md` | 命名規範、擴充 API/中介層/DB 步驟、環境變數 |
| `./FEATURES.md` | 功能行為、參數規格、商業邏輯、錯誤情境 |
| `./TESTING.md` | 測試檔結構、執行順序、輔助函式、撰寫指南 |
| `./CHANGELOG.md` | 文件與系統變更紀錄 |

## 計畫文件位置
- 開發中計畫：`docs/plans/`
- 完成歸檔：`docs/plans/archive/`
