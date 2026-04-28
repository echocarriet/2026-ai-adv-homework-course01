# 功能清單與狀態

## 狀態定義
- `Completed`：程式已實作且有測試覆蓋。
- `Partial`：程式有雛形但未完整接線。

## 1. 帳號與身份（Completed）

### 1.1 註冊
- Endpoint: `POST /api/auth/register`
- Body 必填：`email`, `password`, `name`
- Body 選填：無
- 驗證規則：
  - `email` 必須通過 regex
  - `password.length >= 6`
  - email 不可重複（unique）
- 業務邏輯：
  - 建立 `users`（role 固定 `user`）
  - bcrypt hash 密碼（round=10）
  - 立即簽發 JWT（7d）
- 錯誤碼與情境：
  - `400 VALIDATION_ERROR`：必填缺失/格式錯誤
  - `409 CONFLICT`：email 已存在

### 1.2 登入
- Endpoint: `POST /api/auth/login`
- Body 必填：`email`, `password`
- 邏輯：驗證帳號存在與 bcrypt compare，成功回傳 token + user。
- 錯誤：
  - `400 VALIDATION_ERROR`：缺欄
  - `401 UNAUTHORIZED`：帳密不符

### 1.3 取得個人資料
- Endpoint: `GET /api/auth/profile`
- 認證：Bearer JWT
- 邏輯：依 `req.user.userId` 查使用者公開欄位。
- 錯誤：
  - `401 UNAUTHORIZED`：token 缺失/無效/過期
  - `404 NOT_FOUND`：token user 不存在

## 2. 商品瀏覽（Completed）

### 2.1 商品列表
- Endpoint: `GET /api/products`
- Query：
  - `page`（預設 1，最小 1）
  - `limit`（預設 10，範圍 1~100）
- 回傳：`products[]` + `pagination`
- 排序：`created_at DESC`

### 2.2 商品詳情
- Endpoint: `GET /api/products/:id`
- Path 必填：`id`
- 錯誤：`404 NOT_FOUND`（商品不存在）

## 3. 購物車（Dual-mode，Completed）

### 非標準機制：雙模式認證
- 若有合法 `Authorization` -> 以會員購物車（`user_id`）操作。
- 否則若有 `X-Session-Id` -> 以訪客購物車（`session_id`）操作。
- 若有 Authorization 但 token 壞掉，直接 401，不 fallback session。

### 3.1 讀取購物車
- Endpoint: `GET /api/cart`
- Query：無
- 回傳：`items[]`（內含 `product` 快照）+ `total`

### 3.2 加入購物車
- Endpoint: `POST /api/cart`
- Body 必填：`productId`
- Body 選填：`quantity`（預設 `1`）
- 業務邏輯：
  - 若同商品已在同 owner 購物車，採「累加」而非覆蓋
  - 累加後不得超過 `products.stock`
- 錯誤：
  - `400 VALIDATION_ERROR`：`productId` 缺失或 `quantity` 非正整數
  - `400 STOCK_INSUFFICIENT`：超過庫存
  - `404 NOT_FOUND`：商品不存在

### 3.3 更新購物車數量
- Endpoint: `PATCH /api/cart/:itemId`
- Body 必填：`quantity`（正整數）
- 邏輯：
  - item 必須屬於當前 owner（user/session）
  - quantity 不得超過商品庫存
- 錯誤：
  - `400 VALIDATION_ERROR`
  - `400 STOCK_INSUFFICIENT`
  - `404 NOT_FOUND`（項目不存在或非該 owner）

### 3.4 移除購物車項目
- Endpoint: `DELETE /api/cart/:itemId`
- 邏輯：僅可刪 owner 自己的 item
- 錯誤：`404 NOT_FOUND`

## 4. 訂單（Completed）

### 4.1 建立訂單
- Endpoint: `POST /api/orders`
- 認證：JWT 必須
- Body 必填：`recipientName`, `recipientEmail`, `recipientAddress`
- Body 選填：無
- 驗證：`recipientEmail` 必須合法
- 業務邏輯（關鍵）：
  - 僅使用 `ci.user_id = req.user.userId` 的購物車
  - 檢查購物車非空
  - 檢查每個項目庫存足夠
  - 計算總價（不含運費欄位，運費僅前端呈現）
  - transaction 內完成：
    1. 建立 `orders`
    2. 建立 `order_items`（商品名稱與價格快照）
    3. 扣 `products.stock`
    4. 清空會員購物車
- 錯誤：
  - `400 VALIDATION_ERROR`：收件欄位缺失或 Email 格式錯誤
  - `400 CART_EMPTY`
  - `400 STOCK_INSUFFICIENT`（訊息含不足庫存商品名）

### 4.2 訂單列表
- Endpoint: `GET /api/orders`
- 邏輯：只看當前 user 訂單，依 `created_at DESC`。

### 4.3 訂單詳情
- Endpoint: `GET /api/orders/:id`
- 邏輯：`id` 與 `user_id` 同時匹配，防止越權。
- 錯誤：`404 NOT_FOUND`

### 4.4 模擬付款
- Endpoint: `PATCH /api/orders/:id/pay`
- Body 必填：`action`（`success` 或 `fail`）
- 狀態轉移：僅允許 `pending -> paid|failed`
- 錯誤：
  - `400 VALIDATION_ERROR`：action 非法
  - `400 INVALID_STATUS`：訂單非 pending
  - `404 NOT_FOUND`：找不到該 user 訂單

## 5. 後台商品管理（Completed）

### 5.1 列表
- Endpoint: `GET /api/admin/products`
- Query：`page` 預設 1、`limit` 預設 10（1~100）
- 權限：`authMiddleware + adminMiddleware`

### 5.2 新增商品
- Endpoint: `POST /api/admin/products`
- Body 必填：`name`, `price`, `stock`
- Body 選填：`description`, `image_url`
- 驗證：
  - `price` 正整數
  - `stock` 非負整數
- 錯誤：`400 VALIDATION_ERROR`

### 5.3 編輯商品
- Endpoint: `PUT /api/admin/products/:id`
- Body 全欄位選填（partial update）
- 邏輯：未帶欄位沿用舊值；更新 `updated_at=datetime('now')`
- 錯誤：
  - `404 NOT_FOUND`
  - `400 VALIDATION_ERROR`

### 5.4 刪除商品
- Endpoint: `DELETE /api/admin/products/:id`
- 業務限制：若商品存在於任何 `pending` 訂單，禁止刪除
- 錯誤：
  - `404 NOT_FOUND`
  - `409 CONFLICT`：存在未完成訂單

## 6. 後台訂單管理（Completed）

### 6.1 訂單列表
- Endpoint: `GET /api/admin/orders`
- Query：
  - `page`（預設 1）
  - `limit`（預設 10，1~100）
  - `status`（可用 `pending|paid|failed`）
- 行為：`status` 非允許值時會被忽略（不報錯，回全部）。

### 6.2 訂單詳情
- Endpoint: `GET /api/admin/orders/:id`
- 回傳：訂單主體 + `items[]` + 下單者 `user(name,email)`。
- 錯誤：`404 NOT_FOUND`

## 7. 前端流程（Completed）
- `front` layout 頁面載入後透過 `header-init.js` 決定登入區、訂單連結顯示與購物車 badge。
- `apiFetch` 一旦收到 401 會清空 localStorage token/user 並導向 `/login`。
- `Auth.getAuthHeaders()` 永遠送 `X-Session-Id`，已登入時再加 `Authorization`，配合後端 dual-mode。

## 8. 金流整合（Completed）

### 8.1 發起綠界付款
- Endpoint: `POST /api/orders/:id/payment/start`
- 認證：JWT 必須
- Path 必填：`id`（訂單 id）
- Query：無
- Body：無
- 業務邏輯：
  - 僅允許訂單擁有者操作（`id + user_id` 同時匹配）
  - 僅允許 `pending` 訂單發起付款
  - 每次發起付款都會重新配置新的 `MerchantTradeNo`
  - 新 `MerchantTradeNo` 會先寫回 `orders.merchant_trade_no`，再簽章產出 ECPay 表單欄位
  - 回傳 `{ action, method, fields }` 供前端建立自動提交表單導向綠界
- 非標準機制（重試防重複編號）：
  - 為避免綠界錯誤 `10300028`（訂單編號重覆），同一筆 `pending` 訂單每次重試都不重用舊交易編號
  - 後端會在本地檢查 `merchant_trade_no` 不可與既有訂單重複（DB 亦有 unique index）
- 錯誤碼與情境：
  - `404 NOT_FOUND`：訂單不存在或非本人訂單
  - `400 INVALID_STATUS`：訂單不是 `pending`
  - `500 TRADE_NO_ALLOCATE_FAILED`：交易編號配置失敗
  - `500 ECPAY_CONFIG_ERROR`：ECPay 環境變數設定不完整

### 8.2 主動查詢付款結果（本地端無 Server Notify）
- Endpoint: `POST /api/orders/:id/payment/verify`
- 認證：JWT 必須
- Path 必填：`id`
- Query：無
- Body：無
- 業務邏輯：
  - 後端以 `orders.merchant_trade_no` 呼叫 ECPay `QueryTradeInfo/V5`
  - 若 `TradeStatus === '1'` 且訂單仍是 `pending`：
    - 更新 `orders.status = 'paid'`
    - 寫入 `paid_at`, `payment_method`, `payment_raw`
  - 若尚未成功付款：
    - 保留原訂單狀態
    - 更新查詢回傳資料（例如 `payment_method`, `payment_raw`）以利追蹤
- 錯誤碼與情境：
  - `404 NOT_FOUND`：訂單不存在或非本人訂單
  - `400 PAYMENT_NOT_STARTED`：尚未發起付款（無 `merchant_trade_no`）
  - `502 ECPAY_QUERY_FAILED`：查詢綠界失敗（網路或上游錯誤）

### 8.3 模擬付款（開發輔助）
- Endpoint: `PATCH /api/orders/:id/pay`
- Body 必填：`action`（`success` 或 `fail`）
- 用途：保留給開發/測試流程，正式付款流程以綠界 `start + verify` 為主。
