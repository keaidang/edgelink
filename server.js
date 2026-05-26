import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON and text bodies
app.use(express.json());
app.use(express.text());

// Initialize local mock KV storage
globalThis.__mockKV = new Map();

// Pre-populate with sample records for instant local validation
globalThis.__mockKV.set('link:google', JSON.stringify({
  type: 'url',
  code: 'google',
  url: 'https://www.google.com',
  createdAt: new Date().toISOString(),
  clicks: 12,
  viewLimit: null,
  customCode: true
}));
globalThis.__mockKV.set('link:note', JSON.stringify({
  type: 'text',
  code: 'note',
  text: 'Hello from EdgeLink! This is a secure text share note with a view count limit of 5.',
  createdAt: new Date().toISOString(),
  clicks: 0,
  viewLimit: 5,
  customCode: true
}));

// Local environment variables simulating EdgeOne console bindings
const LOCAL_ENV = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'admin123',
};

// Helper: Converts Express req/res to Web API Request/Response
function buildWebContext(req, res) {
  // Build headers
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  });

  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  // Build Request object
  const webRequest = {
    method: req.method,
    url: fullUrl,
    headers: headers,
    // Emulate cloned json reader
    json: async () => req.body,
    clone: () => ({
      json: async () => req.body
    })
  };

  return {
    request: webRequest,
    params: req.params || {},
    env: LOCAL_ENV,
    waitUntil: (promise) => {
      // Execute in background
      promise.catch(err => console.error('[Local Emulation] Error in background task (waitUntil):', err));
    }
  };
}

// Helper: Send standard Response to Express res
async function sendResponse(webRes, expressRes) {
  // Copy headers
  webRes.headers.forEach((val, key) => {
    expressRes.setHeader(key, val);
  });
  
  // Send status
  expressRes.status(webRes.status);
  
  // Send body
  const body = await webRes.text();
  expressRes.send(body);
}

// API Routes
app.post('/api/create', async (req, res) => {
  try {
    const { default: handler } = await import('./edge-functions/api/create.js');
    const context = buildWebContext(req, res);
    const webRes = await handler(context);
    await sendResponse(webRes, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Local Emulation Error: ${err.message}` });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { default: handler } = await import('./edge-functions/api/stats.js');
    const context = buildWebContext(req, res);
    const webRes = await handler(context);
    await sendResponse(webRes, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Local Emulation Error: ${err.message}` });
  }
});

app.get('/api/admin/list', async (req, res) => {
  try {
    const { default: handler } = await import('./edge-functions/api/admin/list.js');
    const context = buildWebContext(req, res);
    const webRes = await handler(context);
    await sendResponse(webRes, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Local Emulation Error: ${err.message}` });
  }
});

app.delete('/api/admin/delete', async (req, res) => {
  try {
    const { default: handler } = await import('./edge-functions/api/admin/delete.js');
    const context = buildWebContext(req, res);
    const webRes = await handler(context);
    await sendResponse(webRes, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Local Emulation Error: ${err.message}` });
  }
});

// Serve frontend assets
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

app.get('/qrcode.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'qrcode.min.js'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.js'));
});

// Root path serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Redirection handler (/:code)
app.get('/:code', async (req, res) => {
  const code = req.params.code;
  
  // Skip static assets and API routes
  if (
    code.includes('.') || 
    code === 'api' || 
    code === 'admin' ||
    req.path.startsWith('/api/')
  ) {
    return res.status(404).send('Not Found');
  }

  try {
    const { default: handler } = await import('./edge-functions/[code].js');
    const context = buildWebContext(req, res);
    const webRes = await handler(context);
    await sendResponse(webRes, res);
  } catch (err) {
    console.error(err);
    res.status(500).send(`Local Emulation Redirect Error: ${err.message}`);
  }
});

// Start listening
app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🚀 EdgeLink Local Emulation Server running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log('==================================================');
  console.log(`🔑 Default ADMIN_TOKEN for Admin Panel: admin123`);
  console.log('==================================================');
});
