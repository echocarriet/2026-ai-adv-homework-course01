const express = require('express');

const router = express.Router();

router.post('/ecpay/notify', (_req, res) => {
  res.type('text/plain').send('1|OK');
});

module.exports = router;
