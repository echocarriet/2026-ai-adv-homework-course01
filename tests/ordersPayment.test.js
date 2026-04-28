const { app, request, registerUser } = require('./setup');

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
});
