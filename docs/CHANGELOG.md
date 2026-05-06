# Changelog

## [Unreleased]
### Added
- 新增並版控 `.codex/config.toml` 與 `.codex/rules/default.rules`，統一專案的 Codex approval/sandbox 與規則設定。
- 建立 `AGENTS.md`，補齊專案概述、常用指令、關鍵規則與 docs 索引。
- 建立 `docs/README.md`，提供快速開始、技術棧、指令表、文件導覽。
- 建立 `docs/ARCHITECTURE.md`，整理啟動流程、路由總覽、認證機制、資料流、DB schema 與金流現況。
- 建立 `docs/DEVELOPMENT.md`，補充命名規範、API/middleware/DB 擴充流程、環境變數表、JSDoc 範例、計畫歸檔流程。
- 建立 `docs/FEATURES.md`，逐功能記錄參數、預設值、業務規則、錯誤碼與非標準機制（dual-mode auth）。
- 建立 `docs/TESTING.md`，整理測試檔案、執行順序、依賴、helper、新增測試步驟與陷阱。
- 建立 `docs/plans/` 與 `docs/plans/archive/` 目錄作為計畫管理基礎結構。

### Changed
- 串接 ECPay 付款流程：新增訂單付款發起（`/api/orders/:id/payment/start`）與主動查詢驗證（`/api/orders/:id/payment/verify`）。
- 因本地端無法接收可公開回打的 Server Notify，付款確認改為由本地端主動呼叫 ECPay `QueryTradeInfo/V5`。
- 調整訂單頁行為：改為「前往綠界付款」與「確認付款狀態」按鈕流程。
- 訂單資料結構擴充付款欄位（`payment_provider`, `merchant_trade_no`, `payment_method`, `paid_at`, `payment_raw`）與 `merchant_trade_no` 唯一索引。
- 補齊 `POST /api/payments/ecpay/notify` 業務邏輯：加入 `CheckMacValue` 驗章、成功付款時的訂單狀態更新，以及 webhook 重送冪等處理。

### Fixed
- 修正綠界錯誤 `10300028`（訂單編號重覆）：
  - 同一筆 `pending` 訂單重試付款時，`payment/start` 每次都重新產生並保存新的 `MerchantTradeNo`，避免重覆送單失敗。
- 補上 notify 失敗關鍵（J8）：不再是固定 `1|OK` no-op，改為可驗證、可更新、可重送的 callback 處理流程。

## [0.1.0] - 2026-04-28
### Added
- 初始版本發布（前後台電商核心流程、JWT 驗證、購物車雙模式、後台管理與自動化測試）。
