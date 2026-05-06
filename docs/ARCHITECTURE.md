# 系統架構

## 架構摘要
本專案是單體應用（Monolith）：
- Express 同時提供 API 與 EJS 頁面路由。
- 前端頁面以 Vue 3（CDN）掛載在 EJS 節點，透過 `fetch` 呼叫 `/api/*`。
- SQLite (`database.sqlite`) 為唯一資料庫，`src/database.js` 啟動時建表與 seed。

## 啟動流程
1. `server.js` 載入 `app.js`。
2. `app.js` 先執行 `require('./src/database')`：
- 建立 DB 連線
- 設定 pragma（WAL、foreign_keys）
- 建立資料表
- seed 管理員與商品
3. 設定 middleware：`cors`、`express.json`、`express.urlencoded`、`sessionMiddleware`
4. 掛載 API 路由與頁面路由。
5. 掛 404 handler（API 與頁面分流）與全域 `errorHandler`。
6. 若直接執行 `server.js`，會先檢查 `JWT_SECRET`，通過才 `listen`。

## 目錄結構與檔案用途

### 根目錄
- `app.js`：Express app 組裝、middleware、路由與錯誤處理。
- `server.js`：啟動入口與 `JWT_SECRET` 啟動前檢查。
- `generate-openapi.js`：輸出 OpenAPI JSON。
- `swagger-config.js`：swagger-jsdoc 設定（含 securitySchemes）。
- `vitest.config.js`：測試順序與執行配置。
- `database.sqlite`：SQLite 實體資料檔（啟動後產生/更新）。

### `src/`
- `database.js`：資料表 schema、seed、transaction 操作入口。
- `routes/authRoutes.js`：註冊、登入、個人資料。
- `routes/productRoutes.js`：前台商品列表/詳情。
- `routes/cartRoutes.js`：購物車（JWT / Session dual-mode）。
- `routes/orderRoutes.js`：訂單建立/列表/詳情/模擬付款。
- `routes/paymentRoutes.js`：ECPay callback 接收端（驗章、狀態更新、冪等 ACK）。
- `services/ecpayService.js`：ECPay 欄位簽章、付款欄位組裝、交易查詢 API 封裝。
- `routes/adminProductRoutes.js`：後台商品 CRUD。
- `routes/adminOrderRoutes.js`：後台訂單查詢。
- `routes/pageRoutes.js`：前後台 EJS 頁面路由。
- `middleware/authMiddleware.js`：Bearer JWT 驗證 + DB 使用者存在檢查。
- `middleware/adminMiddleware.js`：角色檢查（`role === 'admin'`）。
- `middleware/sessionMiddleware.js`：讀取 `x-session-id` 至 `req.sessionId`。
- `middleware/errorHandler.js`：統一錯誤封裝與安全訊息。

### `public/`
- `js/auth.js`：token/user/session localStorage 管理與守衛。
- `js/api.js`：統一 API 呼叫；401 會清 token 並導向 `/login`。
- `js/pages/*.js`：各頁 Vue 行為（前台/後台）。
- `css/input.css`：Tailwind v4 theme token 與 body 樣式。

### `views/`
- `layouts/front.ejs`、`layouts/admin.ejs`：前後台 layout。
- `pages/*.ejs`：前台頁面。
- `pages/admin/*.ejs`：後台頁面。
- `partials/*`：header/footer/notification 等元件。

### `tests/`
- `setup.js`：測試工具（`getAdminToken`, `registerUser`）。
- `*.test.js`：API 測試檔。

## REST API 路由總覽
| 前綴 | 檔案 | 認證機制 | 說明 |
|---|---|---|---|
| `/api/auth` | `src/routes/authRoutes.js` | 部分需 JWT | 註冊、登入、取個人資料 |
| `/api/products` | `src/routes/productRoutes.js` | 無 | 前台商品查詢 |
| `/api/cart` | `src/routes/cartRoutes.js` | JWT 或 `X-Session-Id` | 訪客/會員購物車 |
| `/api/orders` | `src/routes/orderRoutes.js` | JWT | 下單、查訂單、付款發起/查詢、模擬付款 |
| `/api/payments` | `src/routes/paymentRoutes.js` | 無（ECPay 呼叫） | 金流 callback 入口（含 CheckMac 驗證與冪等處理） |
| `/api/admin/products` | `src/routes/adminProductRoutes.js` | JWT + admin | 後台商品管理 |
| `/api/admin/orders` | `src/routes/adminOrderRoutes.js` | JWT + admin | 後台訂單查詢 |

## 頁面路由總覽
| Path | 檔案 | 權限/前置 | 說明 |
|---|---|---|---|
| `/` | `src/routes/pageRoutes.js` | 無 | 首頁 |
| `/products/:id` | `src/routes/pageRoutes.js` | 無 | 商品詳情頁 |
| `/cart` | `src/routes/pageRoutes.js` | 無 | 購物車頁 |
| `/checkout` | `src/routes/pageRoutes.js` | 前端需登入 | 結帳頁 |
| `/login` | `src/routes/pageRoutes.js` | 無 | 登入/註冊頁 |
| `/orders` | `src/routes/pageRoutes.js` | 前端需登入 | 我的訂單列表 |
| `/orders/:id` | `src/routes/pageRoutes.js` | 前端需登入 | 訂單詳情與付款入口 |
| `/admin/products` | `src/routes/pageRoutes.js` | 前端需 admin | 後台商品管理頁 |
| `/admin/orders` | `src/routes/pageRoutes.js` | 前端需 admin | 後台訂單管理頁 |

## 統一回應格式
成功：
```json
{
  "data": {"...": "..."},
  "error": null,
  "message": "成功"
}
```
失敗：
```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "price 必須為正整數"
}
```

備註：`errorHandler` 對未攔截例外固定回 `error: "INTERNAL_ERROR"`，避免洩漏內部訊息。

## 認證與授權機制

### JWT
- 產生點：`authRoutes` 註冊/登入。
- Payload：`{ userId, email, role }`
- 演算法：`HS256`
- 有效期：`7d`
- 驗證點：`authMiddleware` 與 `cartRoutes` 的 `dualAuth` JWT 分支。

### Middleware 行為
- `authMiddleware`
1. 需有 `Authorization: Bearer <token>`。
2. `jwt.verify(..., { algorithms: ['HS256'] })`。
3. 驗證 DB 存在該使用者 id。
4. 寫入 `req.user`（`userId/email/role`）。

- `adminMiddleware`
1. 檢查 `req.user.role === 'admin'`。
2. 否則 403 `FORBIDDEN`。

- `sessionMiddleware`
1. 讀 `x-session-id` header。
2. 若存在寫入 `req.sessionId`。

### 雙模式認證（購物車）
`cartRoutes.dualAuth` 優先 JWT，沒有 token 才 fallback `X-Session-Id`：
- 有 Authorization 且 token 無效：直接 401（不再 fallback session）。
- 無 Authorization 但有 `X-Session-Id`：以訪客模式通過。
- 兩者都無：401。

## 資料流

### 商品瀏覽
`/` 或 `/products/:id` 頁面 -> `public/js/pages/*` -> `GET /api/products*` -> SQLite `products` -> 回傳給 Vue 顯示。

### 加入購物車
前端 `Auth.getAuthHeaders()` 同時送 `Authorization`（若已登入）與 `X-Session-Id`。
後端 `dualAuth` 決定 owner（`user_id` 或 `session_id`）-> `cart_items` insert/update。

### 結帳建立訂單
`POST /api/orders`（需 JWT）-> 讀取 `cart_items(user_id)` + `products` -> 檢查庫存 -> transaction：
1. insert `orders`
2. insert `order_items`
3. update `products.stock = stock - quantity`
4. delete `cart_items where user_id`

### 綠界付款（本地主動查詢模式）
1. 使用者在訂單頁點「前往綠界付款」。
2. 前端呼叫 `POST /api/orders/:id/payment/start`。
3. 後端先為該筆 `pending` 訂單配置新的 `merchant_trade_no`（每次重試都換新，避免 10300028）。
4. 後端組裝 ECPay AIO 欄位並回傳 `{ action, method, fields }`。
5. 前端建立 form POST 到 `https://payment(-stage).ecpay.com.tw/Cashier/AioCheckOut/V5`。
6. 使用者付款後回到商店頁，前端點「確認付款狀態」呼叫 `POST /api/orders/:id/payment/verify`。
7. 後端主動呼叫 ECPay `QueryTradeInfo/V5`：
   - `TradeStatus === 1`：更新訂單為 `paid`
   - 否則：保留 `pending`，僅更新查詢紀錄欄位

### ECPay Server Notify（callback）
- Endpoint：`POST /api/payments/ecpay/notify`
- 核心行為：
  - 驗證 `CheckMacValue`，驗章失敗回 `400 text/plain`：`0|Invalid CheckMac`
  - 驗章成功且對應到訂單時，若 `RtnCode='1'` 且 `TradeStatus='1'`，僅允許 `pending -> paid`
  - 重複通知採冪等處理：已非 `pending` 不重複改狀態，仍回 `1|OK`
  - `MerchantTradeNo` 找不到訂單時回 `200 text/plain`：`1|OK`（避免上游持續重送）
- 備註：本地端仍可透過 `payment/verify` 主動查詢確認付款狀態，與 notify 互為補強。

### 後台管理
前端 admin 頁在 layout 即先 `Auth.requireAdmin()`；後端路由再由 middleware 強制驗證，避免僅靠前端守衛。

## 資料庫 Schema（SQLite）

### `users`
| 欄位 | 型別 | 約束/說明 |
|---|---|---|
| `id` | TEXT | PK |
| `email` | TEXT | UNIQUE, NOT NULL |
| `password_hash` | TEXT | NOT NULL |
| `name` | TEXT | NOT NULL |
| `role` | TEXT | NOT NULL, default `user`, check in (`user`,`admin`) |
| `created_at` | TEXT | NOT NULL, default `datetime('now')` |

### `products`
| 欄位 | 型別 | 約束/說明 |
|---|---|---|
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | nullable |
| `price` | INTEGER | NOT NULL, `price > 0` |
| `stock` | INTEGER | NOT NULL, default 0, `stock >= 0` |
| `image_url` | TEXT | nullable |
| `created_at` | TEXT | NOT NULL default now |
| `updated_at` | TEXT | NOT NULL default now |

### `cart_items`
| 欄位 | 型別 | 約束/說明 |
|---|---|---|
| `id` | TEXT | PK |
| `session_id` | TEXT | 訪客模式使用，可為 null |
| `user_id` | TEXT | 會員模式使用，可為 null，FK -> users.id |
| `product_id` | TEXT | NOT NULL, FK -> products.id |
| `quantity` | INTEGER | NOT NULL default 1, `quantity > 0` |

### `orders`
| 欄位 | 型別 | 約束/說明 |
|---|---|---|
| `id` | TEXT | PK |
| `order_no` | TEXT | UNIQUE, NOT NULL（格式 `ORD-YYYYMMDD-XXXXX`） |
| `user_id` | TEXT | NOT NULL, FK -> users.id |
| `recipient_name` | TEXT | NOT NULL |
| `recipient_email` | TEXT | NOT NULL |
| `recipient_address` | TEXT | NOT NULL |
| `total_amount` | INTEGER | NOT NULL |
| `status` | TEXT | NOT NULL default `pending`, check in (`pending`,`paid`,`failed`) |
| `payment_provider` | TEXT | nullable（目前使用 `ecpay`） |
| `merchant_trade_no` | TEXT | UNIQUE（`idx_orders_merchant_trade_no`） |
| `payment_method` | TEXT | nullable（例：Credit_CreditCard） |
| `paid_at` | TEXT | nullable（由綠界回傳付款時間） |
| `payment_raw` | TEXT | nullable（保存查詢原始回應） |
| `created_at` | TEXT | NOT NULL default now |

### `order_items`
| 欄位 | 型別 | 約束/說明 |
|---|---|---|
| `id` | TEXT | PK |
| `order_id` | TEXT | NOT NULL, FK -> orders.id |
| `product_id` | TEXT | NOT NULL（保留來源商品 id） |
| `product_name` | TEXT | NOT NULL（快照） |
| `product_price` | INTEGER | NOT NULL（快照） |
| `quantity` | INTEGER | NOT NULL |

## 第三方/金流整合（ECPay）
- 付款導向：`AioCheckOut/V5`
- 主動查詢：`QueryTradeInfo/V5`
- 簽章：`CheckMacValue`（SHA256 + ECPay 特定 URL encode 規則）
- 環境切換：
  - `ECPAY_ENV=staging` -> `https://payment-stage.ecpay.com.tw`
  - `ECPAY_ENV=production` -> `https://payment.ecpay.com.tw`
- 本地運行限制下的關鍵決策：
  - 不依賴 Server Notify 做最終狀態更新
  - 以使用者操作觸發 `payment/verify` 主動查詢做為付款確認流程
  - 每次重試付款必換 `MerchantTradeNo`，避免重複編號錯誤 `10300028`
