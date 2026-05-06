const { app, request, registerUser } = require('./setup');
const db = require('../src/database');
const { generateCheckMacValue } = require('../src/services/ecpayService');

describe('Orders Payment API (ECPay)', () => {
  let userToken;
  let orderId;

  beforeAll(async () => {
    const { token } = await registerUser();
    userToken = token;

    const prodRes = await request(app).get('/api/products');
    const productId = prodRes.body.data.products[0].id;

    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId, quantity: 1 });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        recipientName: '付款測試收件人',
        recipientEmail: 'pay-test@example.com',
        recipientAddress: '台北市付款測試路 1 號',
      });

    orderId = orderRes.body.data.id;
  });

  it('should start payment and return ECPay form payload', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment/start`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toHaveProperty('action');
    expect(res.body.data).toHaveProperty('method', 'POST');
    expect(res.body.data).toHaveProperty('fields');
    expect(res.body.data.fields).toHaveProperty('MerchantTradeNo');
    expect(res.body.data.fields).toHaveProperty('CheckMacValue');
    expect(res.body.data.fields).toHaveProperty('ChoosePayment', 'ALL');
  });

  it('should keep pending if query says unpaid', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      status: 200,
      text: async () => 'TradeStatus=0&RtnCode=2&RtnMsg=Get%20status%20not%20paid',
    }));

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment/verify`)
      .set('Authorization', `Bearer ${userToken}`);

    global.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.order.status).toBe('pending');
    expect(res.body.data.payment.tradeStatus).toBe('0');
  });

  it('should update to paid when query confirms paid', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      status: 200,
      text: async () => 'TradeStatus=1&PaymentType=Credit_CreditCard&PaymentDate=2026%2F04%2F28+12%3A00%3A00&RtnCode=1&RtnMsg=OK',
    }));

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment/verify`)
      .set('Authorization', `Bearer ${userToken}`);

    global.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.order.status).toBe('paid');
    expect(res.body.data.payment.tradeStatus).toBe('1');
  });

  async function createOrderAndStartPayment(token) {
    const prodRes = await request(app).get('/api/products');
    const productId = prodRes.body.data.products[0].id;

    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipientName: 'Notify 測試收件人',
        recipientEmail: 'notify-test@example.com',
        recipientAddress: '台北市 Notify 路 1 號',
      });

    const id = orderRes.body.data.id;
    const startRes = await request(app)
      .post(`/api/orders/${id}/payment/start`)
      .set('Authorization', `Bearer ${token}`);

    return {
      orderId: id,
      merchantTradeNo: startRes.body.data.fields.MerchantTradeNo,
    };
  }

  function buildNotifyPayload(overrides = {}) {
    const payload = {
      MerchantID: process.env.ECPAY_MERCHANT_ID,
      MerchantTradeNo: overrides.MerchantTradeNo || 'FLTESTTRADE000000001',
      RtnCode: overrides.RtnCode || '1',
      RtnMsg: overrides.RtnMsg || 'Succeeded',
      TradeNo: overrides.TradeNo || '261234567890',
      TradeAmt: overrides.TradeAmt || '1680',
      PaymentDate: overrides.PaymentDate || '2026/05/06 10:00:00',
      PaymentType: overrides.PaymentType || 'Credit_CreditCard',
      TradeDate: overrides.TradeDate || '2026/05/06 10:00:00',
      SimulatePaid: overrides.SimulatePaid || '0',
      TradeStatus: overrides.TradeStatus || '1',
    };
    const mac = generateCheckMacValue(payload, process.env.ECPAY_HASH_KEY, process.env.ECPAY_HASH_IV);
    return { ...payload, CheckMacValue: mac };
  }

  it('should update pending order to paid when notify is valid and paid', async () => {
    const { token } = await registerUser();
    const { orderId, merchantTradeNo } = await createOrderAndStartPayment(token);
    const payload = buildNotifyPayload({ MerchantTradeNo: merchantTradeNo });

    const res = await request(app)
      .post('/api/payments/ecpay/notify')
      .type('form')
      .send(payload);

    const updated = db.prepare('SELECT status, paid_at, payment_method FROM orders WHERE id = ?').get(orderId);
    expect(res.status).toBe(200);
    expect(res.text).toBe('1|OK');
    expect(updated.status).toBe('paid');
    expect(updated.paid_at).toBe(payload.PaymentDate);
    expect(updated.payment_method).toBe(payload.PaymentType);
  });

  it('should be idempotent for duplicate paid notify', async () => {
    const { token } = await registerUser();
    const { orderId, merchantTradeNo } = await createOrderAndStartPayment(token);
    const payload = buildNotifyPayload({ MerchantTradeNo: merchantTradeNo });

    const firstRes = await request(app).post('/api/payments/ecpay/notify').type('form').send(payload);
    const secondRes = await request(app).post('/api/payments/ecpay/notify').type('form').send(payload);

    const updated = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    expect(firstRes.text).toBe('1|OK');
    expect(secondRes.text).toBe('1|OK');
    expect(updated.status).toBe('paid');
  });

  it('should reject notify when checkmac is invalid', async () => {
    const { token } = await registerUser();
    const { merchantTradeNo } = await createOrderAndStartPayment(token);
    const payload = buildNotifyPayload({ MerchantTradeNo: merchantTradeNo, CheckMacValue: 'INVALID' });
    payload.CheckMacValue = 'INVALID';

    const res = await request(app)
      .post('/api/payments/ecpay/notify')
      .type('form')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.text).toBe('0|Invalid CheckMac');
  });

  it('should ack unknown merchant trade no with 1|OK', async () => {
    const payload = buildNotifyPayload({ MerchantTradeNo: 'FLUNKNOWNTRADE000001' });

    const res = await request(app)
      .post('/api/payments/ecpay/notify')
      .type('form')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.text).toBe('1|OK');
  });
});
