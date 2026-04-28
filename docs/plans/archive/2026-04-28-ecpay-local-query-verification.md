# ECPay 本地端主動查詢驗證串接計畫

## User Story
- 作為使用者，我可以從訂單頁前往綠界付款並返回本站。
- 作為系統，我在本地端無法接收穩定的 Server Notify 時，仍可透過主動查詢 API 正確確認付款結果。
- 作為開發者，我需要可追蹤的付款欄位與可測試的 API，確保付款流程可維護。

## Spec
### 目標
將既有「模擬付款」流程升級為 ECPay AIO 流程，並以「手動查詢交易狀態」作為付款確認機制。

### 核心決策
- 付款方式：`ChoosePayment=ALL`
- 導向方式：同頁跳轉綠界
- 驗證策略：由訂單頁手動按鈕觸發 `QueryTradeInfo` 查詢
- 本地限制：不依賴 Server Notify 更新最終訂單狀態

### API / 資料結構
- 新增 `POST /api/orders/:id/payment/start`
  - 產生 AIO 表單 payload（含 CheckMacValue）
- 新增 `POST /api/orders/:id/payment/verify`
  - 主動查詢 `QueryTradeInfo/V5`
  - `TradeStatus=1` 時更新本地訂單為 `paid`
- 新增 `POST /api/payments/ecpay/notify`
  - 回應 `1|OK`（僅避免重送，不作為付款最終依據）
- `orders` 擴充欄位：
  - `payment_provider`
  - `merchant_trade_no`（unique index）
  - `payment_method`
  - `paid_at`
  - `payment_raw`

### 前端流程
- 訂單詳情頁 pending 狀態提供：
  - `前往綠界付款`
  - `確認付款狀態`
- 移除模擬付款成功/失敗按鈕

### 驗收標準
- 可建立 ECPay 付款 payload 並成功導向綠界。
- 返回後手動查詢可正確將訂單從 `pending` 轉 `paid`。
- 未付款時查詢不誤改狀態。
- 全部測試通過。

## Tasks
1. 建立 ECPay service（CMV、AIO payload、查詢 API）。
2. 擴充 orders schema（向後相容補欄位 + index）。
3. 新增 `payment/start` 與 `payment/verify` API。
4. 新增 notify endpoint 並掛載路由。
5. 改寫訂單詳情頁付款按鈕與 submit/query 行為。
6. 新增測試檔覆蓋 start/verify 成功與未付款分支。
7. 執行測試並確認回歸無破壞。
