# 測試規範與指南

## 測試框架與策略
- 測試工具：Vitest + Supertest
- 型態：整合測試（直接打 `app` 的 HTTP API）
- `fileParallelism: false`，固定順序執行，降低共享資料庫造成的互相污染風險。

## 測試檔案表
| 檔案 | 覆蓋範圍 | 依賴 |
|---|---|---|
| `tests/setup.js` | 測試 helper | 所有測試檔 |
| `tests/auth.test.js` | 註冊/登入/profile | DB seed admin |
| `tests/products.test.js` | 商品列表/詳情 | seed 商品 |
| `tests/cart.test.js` | 訪客與會員購物車 | products API |
| `tests/orders.test.js` | 訂單建立/查詢 | cart + auth |
| `tests/adminProducts.test.js` | 後台商品 CRUD | admin token |
| `tests/adminOrders.test.js` | 後台訂單查詢 | 先建立一般用戶訂單 |

## 執行順序與依賴關係
`vitest.config.js` 設定固定順序：
1. `auth.test.js`
2. `products.test.js`
3. `cart.test.js`
4. `orders.test.js`
5. `adminProducts.test.js`
6. `adminOrders.test.js`

理由：
- 後段測試會依賴前面已驗證之核心流程（例如先有商品/購物車，才有訂單）。
- DB 為共享 SQLite，順序固定可提高重現性。

## 輔助函式說明（`tests/setup.js`）
- `getAdminToken()`
  - 透過 `/api/auth/login` 使用 seed 管理員登入。
  - 回傳 JWT token。
- `registerUser(overrides)`
  - 自動產生不重複 email 註冊新帳號。
  - 可覆寫 `email/password/name`。
  - 回傳 `{ token, user }`。

## 撰寫新測試步驟
1. 決定測試目標路由與預期行為（成功/失敗至少各一）。
2. 使用 `setup.js` helper 建立前置身份或資料。
3. 呼叫 API 並驗證：
- HTTP status
- `data/error/message` 結構
- 關鍵業務欄位
4. 若涉及狀態改變（例如扣庫存），再做後續 API 查詢驗證 side-effect。
5. 將測試檔加到 `vitest.config.js` `sequence.files` 適當位置。

## 新測試範例
```js
it('should reject invalid quantity', async () => {
  const res = await request(app)
    .post('/api/cart')
    .set('X-Session-Id', 'sid-demo')
    .send({ productId: 'xxx', quantity: 0 });

  expect(res.status).toBe(400);
  expect(res.body).toHaveProperty('data', null);
  expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
});
```

## 常見陷阱
- 測試資料唯一性：register 需避免重複 email，請用 timestamp/random。
- 狀態耦合：前一測試可能清空購物車或改變庫存，需在 `beforeAll` 明確建立自己的前置資料。
- dual-mode 行為：
  - 若同時送壞掉 token + session id，後端會直接 401。
  - 不要誤以為會 fallback session。
- 訂單付款狀態：只有 `pending` 可付款，重複付款要驗證 `INVALID_STATUS`。

## 執行指令
```bash
npm test
```
