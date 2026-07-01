const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const port = 3000;

// Local mock for zoho-payment-init
app.post('/api/zoho-payment-init', (req, res) => {
  res.json({
    simulated: true,
    orderId: `ZOHO_ORD_SIM_${Date.now()}`,
    hostedUrl: `/simulated-zoho-checkout.html?amt=5000`,
    amount: 5000,
    currency: 'INR'
  });
});

// Proxy everything else in /api to Supabase functions
// Note: Vercel rewrites often point /api/foo to /functions/v1/foo
app.use('/api', createProxyMiddleware({
  target: 'https://zznbanjdkwofsvpzybtr.supabase.co',
  changeOrigin: true,
  pathRewrite: {
    '^/': '/functions/v1/' // req.url is just '/auth' here, so prepend /functions/v1/
  },
  onProxyReq: (proxyReq, req, res) => {
    // Optional: Log proxy requests for debugging
    console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
  },
  logLevel: 'info'
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Development proxy server running on http://localhost:${port}`);
});
