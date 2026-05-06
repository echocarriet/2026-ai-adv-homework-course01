const crypto = require('crypto');

const STAGE_BASE = 'https://payment-stage.ecpay.com.tw';
const PROD_BASE = 'https://payment.ecpay.com.tw';

function getConfig() {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIv = process.env.ECPAY_HASH_IV;
  const env = (process.env.ECPAY_ENV || 'staging').toLowerCase();

  if (!merchantId || !hashKey || !hashIv) {
    throw new Error('ECPAY 設定不完整，請設定 ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV');
  }

  return {
    merchantId,
    hashKey,
    hashIv,
    baseUrl: env === 'production' ? PROD_BASE : STAGE_BASE
  };
}

function ecpayUrlEncode(value) {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27')
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

function generateCheckMacValue(input, hashKey, hashIv) {
  const sorted = Object.keys(input)
    .filter((k) => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const query = sorted.map((k) => `${k}=${input[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${query}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);

  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

function verifyCheckMacValue(input) {
  const { hashKey, hashIv } = getConfig();
  const received = String(input.CheckMacValue || '').toUpperCase();
  if (!received) return false;
  const expected = generateCheckMacValue(input, hashKey, hashIv);
  return expected === received;
}

function generateMerchantTradeNo() {
  const millis = Date.now().toString();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FL${millis}${random}`.slice(0, 20);
}

function buildItemName(items) {
  const raw = items.map((item) => `${item.product_name} ${item.product_price} TWD x ${item.quantity}`).join('#');
  let out = raw;
  while (Buffer.byteLength(out, 'utf8') > 200) {
    out = out.slice(0, -1);
  }
  return out || 'Flower Order';
}

function buildCreatePaymentFields({ merchantTradeNo, totalAmount, tradeDesc, itemName, returnUrl, clientBackUrl }) {
  const { merchantId, hashKey, hashIv } = getConfig();
  const fields = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/'),
    PaymentType: 'aio',
    TotalAmount: Math.round(totalAmount),
    TradeDesc: tradeDesc,
    ItemName: itemName,
    ReturnURL: returnUrl,
    ChoosePayment: 'ALL',
    EncryptType: 1,
    ClientBackURL: clientBackUrl,
  };

  fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIv);
  return fields;
}

async function queryTradeInfo(merchantTradeNo) {
  const { merchantId, hashKey, hashIv, baseUrl } = getConfig();
  const payload = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: Math.floor(Date.now() / 1000),
  };
  payload.CheckMacValue = generateCheckMacValue(payload, hashKey, hashIv);

  const body = new URLSearchParams(payload).toString();
  const res = await fetch(`${baseUrl}/Cashier/QueryTradeInfo/V5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));
  return { httpStatus: res.status, raw: text, parsed };
}

function getCheckoutActionUrl() {
  const { baseUrl } = getConfig();
  return `${baseUrl}/Cashier/AioCheckOut/V5`;
}

module.exports = {
  buildCreatePaymentFields,
  buildItemName,
  generateMerchantTradeNo,
  getCheckoutActionUrl,
  generateCheckMacValue,
  queryTradeInfo,
  verifyCheckMacValue,
};
