# 開發規範

## 命名規則對照表
| 範疇 | 目前慣例 | 範例 |
|---|---|---|
| 路由檔名 | `camelCase + Routes.js` | `adminProductRoutes.js` |
| middleware 檔名 | `camelCase + Middleware.js` | `authMiddleware.js` |
| 前端頁面腳本 | kebab-case 對應 EJS pageScript | `public/js/pages/order-detail.js` |
| API path | REST + 複數資源名 | `/api/products`, `/api/orders/:id/pay` |
| DB 欄位 | snake_case | `order_no`, `created_at` |
| JSON body 欄位 | 前端/後端採 camelCase | `recipientName`, `productId` |
| 錯誤碼 | 全大寫底線 | `VALIDATION_ERROR` |

## 模組系統說明
- 後端為 CommonJS：`require/module.exports`。
- 前端 `public/js/*.js` 為瀏覽器全域腳本，不是 ES module；依賴載入順序由 layout 決定：
1. `auth.js`
2. `api.js`
3. `notification.js`
4. `header-init.js`（front layout）
5. page script

## 新增 API 步驟（建議流程）
1. 在對應 `src/routes/*` 新增路由與輸入驗證。
2. 統一回傳 `{ data, error, message }`。
3. 需要權限時掛 `authMiddleware` / `adminMiddleware`。
4. 補 `@openapi` 區塊，確保 `npm run openapi` 可輸出。
5. 在 `tests/` 新增或擴充測試。
6. 若有前端頁面，更新 `public/js/pages/*` 呼叫與錯誤訊息顯示。
7. 更新 `docs/FEATURES.md` 與 `docs/CHANGELOG.md`。

## 新增 Middleware 步驟
1. 於 `src/middleware/` 新增 `<name>Middleware.js`。
2. 輸出函式簽名 `function (req, res, next)`。
3. 失敗回應需符合統一錯誤格式。
4. 在 `app.js` 或單一路由檔掛載。
5. 增加對應測試（成功/失敗路徑）。

## 新增 DB 結構步驟
1. 在 `src/database.js` `initializeDatabase()` 內調整 `CREATE TABLE IF NOT EXISTS`。
2. 若有關聯，明確定義 FK 與 CHECK。
3. 新邏輯涉及多表一致性，必須使用 `db.transaction`。
4. 更新 `docs/ARCHITECTURE.md` schema 區。
5. 補測試覆蓋欄位約束與交易行為。

## 環境變數表
| 變數 | 用途 | 必要性 | 預設值 |
|---|---|---|---|
| `JWT_SECRET` | JWT 簽章與驗證 | 必填（`server.js` 啟動檢查） | 無 |
| `PORT` | server 監聽埠 | 選填 | `3001` |
| `FRONTEND_URL` | CORS `origin` | 選填 | `http://localhost:3001`（程式 fallback） |
| `BASE_URL` | 目前未被程式直接讀取（保留） | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | seed 管理員帳號 | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | seed 管理員密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | ECPay 參數（尚未接線） | 選填 | `.env.example` 提供 |
| `ECPAY_HASH_KEY` | ECPay 參數（尚未接線） | 選填 | `.env.example` 提供 |
| `ECPAY_HASH_IV` | ECPay 參數（尚未接線） | 選填 | `.env.example` 提供 |
| `ECPAY_ENV` | ECPay 環境（尚未接線） | 選填 | `staging` |
| `NODE_ENV` | 控制 seed bcrypt round（test=1） | 選填 | 依 runtime |

## JSDoc / OpenAPI 格式說明
路由上方使用 `@openapi` 註解，`npm run openapi` 會掃描 `src/routes/*.js`。

範例（簡化）：
```js
/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: 取得商品列表
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: 成功
 */
router.get('/', handler);
```

## 錯誤處理準則
- 可預期錯誤（驗證、授權、不存在）在 route 內直接回應適當 status + error code。
- 非預期錯誤交給 `errorHandler`，避免直接回傳 stack。
- `errorHandler` 對 500 固定 `伺服器內部錯誤`。

## 計畫歸檔流程

1. 計畫檔案命名格式：`YYYY-MM-DD-<feature-name>.md`
2. 計畫文件結構：`User Story -> Spec -> Tasks`
3. 功能完成後：移至 `docs/plans/archive/`
4. 更新 `docs/FEATURES.md` 和 `docs/CHANGELOG.md`
