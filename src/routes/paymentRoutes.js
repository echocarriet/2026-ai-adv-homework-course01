const express = require('express');
const db = require('../database');
const { verifyCheckMacValue } = require('../services/ecpayService');

const router = express.Router();

function isPaidNotify(payload) {
  return payload.RtnCode === '1' && payload.TradeStatus === '1';
}

router.post('/ecpay/notify', (req, res) => {
  const payload = req.body || {};
  const merchantTradeNo = payload.MerchantTradeNo;

  if (!merchantTradeNo || !payload.RtnCode || !payload.CheckMacValue) {
    return res.status(400).type('text/plain').send('0|Invalid Payload');
  }

  let validMac = false;
  try {
    validMac = verifyCheckMacValue(payload);
  } catch (err) {
    console.error('[ECPay notify] verify mac failed:', err.message);
    return res.status(400).type('text/plain').send('0|Invalid CheckMac');
  }

  if (!validMac) {
    console.warn('[ECPay notify] invalid checkmac:', { merchantTradeNo });
    return res.status(400).type('text/plain').send('0|Invalid CheckMac');
  }

  const order = db.prepare(
    'SELECT id, status FROM orders WHERE merchant_trade_no = ? LIMIT 1'
  ).get(merchantTradeNo);

  if (!order) {
    console.warn('[ECPay notify] order not found:', { merchantTradeNo });
    return res.type('text/plain').send('1|OK');
  }

  const paymentDate = payload.PaymentDate || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const paymentType = payload.PaymentType || null;
  const paymentRaw = JSON.stringify(payload);

  if (isPaidNotify(payload)) {
    const result = db.prepare(
      `UPDATE orders
       SET status = 'paid',
           paid_at = ?,
           payment_method = COALESCE(?, payment_method),
           payment_raw = ?
       WHERE id = ? AND status = 'pending'`
    ).run(paymentDate, paymentType, paymentRaw, order.id);

    if (result.changes === 0) {
      console.info('[ECPay notify] idempotent paid notify:', { merchantTradeNo, currentStatus: order.status });
      db.prepare(
        `UPDATE orders
         SET payment_method = COALESCE(?, payment_method),
             payment_raw = ?
         WHERE id = ?`
      ).run(paymentType, paymentRaw, order.id);
    }
  } else {
    db.prepare(
      `UPDATE orders
       SET payment_method = COALESCE(?, payment_method),
           payment_raw = ?
       WHERE id = ?`
    ).run(paymentType, paymentRaw, order.id);
  }

  return res.type('text/plain').send('1|OK');
});

module.exports = router;
