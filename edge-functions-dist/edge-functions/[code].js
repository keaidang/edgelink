// ---- Shared KV & CORS utilities for EdgeLink edge functions ----
// This file is inlined into each edge function during the build step
// for EdgeOne Pages compatibility (no cross-file imports in edge runtime).

function getKV(context) {
  if (context && context.env && context.env.link) {
    return context.env.link;
  }
  if (typeof link !== 'undefined' && link !== null) {
    return link;
  }
  if (context && context.env && context.env.SHORT_LINK_KV) {
    return context.env.SHORT_LINK_KV;
  }
  if (typeof SHORT_LINK_KV !== 'undefined' && SHORT_LINK_KV !== null) {
    return SHORT_LINK_KV;
  }

  const urlStr = context?.request?.url || '';
  const isLocal = urlStr.includes('localhost') || urlStr.includes('127.0.0.1') || urlStr.includes('3000');

  if (!isLocal) {
    throw new Error("Tencent Cloud KV namespace 'link' is not defined. Please ensure you have bound your KV namespace in EdgeOne Pages project settings with the variable name 'link', and that you have triggered a new deployment to apply the settings.");
  }

  return getMockKV();
}

if (!globalThis.__mockKV) {
  globalThis.__mockKV = new Map();
}
function getMockKV() {
  return {
    async get(key, options) {
      const val = globalThis.__mockKV.get(key);
      if (val === undefined || val === null) return null;
      if (options && options.type === 'json') {
        try {
          return JSON.parse(val);
        } catch(e) {
          return val;
        }
      }
      return val;
    },
    async put(key, value) {
      globalThis.__mockKV.set(key, String(value));
    },
    async delete(key) {
      globalThis.__mockKV.delete(key);
    },
    async list(options) {
      let keys = Array.from(globalThis.__mockKV.keys());
      if (options && options.prefix) {
        keys = keys.filter(k => k.startsWith(options.prefix));
      }
      return {
        keys: keys.map(k => ({ name: k })),
        list_complete: true
      };
    }
  };
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function corsHeadersPublic() {
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function verifyAdminAuth(context) {
  const adminToken = context?.env?.ADMIN_TOKEN || (typeof ADMIN_TOKEN !== 'undefined' ? ADMIN_TOKEN : null);

  if (!adminToken) {
    return {
      authorized: false,
      status: 403,
      error: 'ADMIN_TOKEN environment variable is not configured. Admin panel is locked.'
    };
  }

  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized. Missing Bearer Token.'
    };
  }

  const clientToken = authHeader.substring(7).trim();
  if (clientToken !== adminToken) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized. Invalid Admin Token.'
    };
  }

  return { authorized: true };
}

// Generic KV-based rate limiter
async function checkRateLimit(kv, key, maxRequests, windowMs) {
  const now = Date.now();
  const recordKey = `ratelimit:${key}`;
  const raw = await kv.get(recordKey);
  const record = raw
    ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
    : { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count++;
  await kv.put(recordKey, JSON.stringify(record));

  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetAt
  };
}
function htmlPage(title, bodyContent, style = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EdgeLink - ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: hsl(224, 25%, 7%);
      --card-bg: rgba(13, 17, 26, 0.65);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-primary: hsl(0, 0%, 95%);
      --text-secondary: hsl(224, 12%, 68%);
      --text-muted: hsl(224, 10%, 45%);
      --primary-color: hsl(252, 100%, 67%);
      --accent-color: hsl(190, 100%, 50%);
      --success-color: hsl(145, 80%, 46%);
      --danger-color: hsl(355, 85%, 55%);
      --primary-gradient: linear-gradient(135deg, var(--primary-color), var(--accent-color));
      --radius-lg: 20px;
      --radius-md: 14px;
      --font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', sfmono-regular, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-sans);
      background-color: var(--bg-color);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      overflow-x: hidden;
    }
    .bg-glow {
      position: absolute;
      top: -10%; left: 50%;
      transform: translateX(-50%);
      width: 90vw; height: 60vh;
      background: radial-gradient(circle, hsla(252, 100%, 67%, 0.12) 0%, hsla(190, 100%, 50%, 0.04) 50%, transparent 80%);
      z-index: -1;
      pointer-events: none;
      filter: blur(80px);
    }
    .card {
      width: 100%;
      max-width: 600px;
      background: var(--card-bg);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 30px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      animation: fadeIn 0.4s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      font-size: 1.2rem;
      font-weight: 800;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-decoration: none;
    }
    .logo span { font-weight: 300; color: var(--text-primary); -webkit-text-fill-color: initial; }
    h2 { font-size: 1.6rem; font-weight: 700; margin-bottom: 12px; }
    p { color: var(--text-secondary); margin-bottom: 20px; font-size: 0.95rem; }
    .content-box {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 20px;
      font-family: var(--font-mono);
      font-size: 0.95rem;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      margin-bottom: 20px;
    }
    .badge-info { background: rgba(190, 100, 50, 0.08); color: var(--accent-color); border-color: rgba(190, 100, 50, 0.2); }
    .badge-danger { background: rgba(355, 85, 55, 0.08); color: var(--danger-color); border-color: rgba(355, 85, 55, 0.2); }
    .badge-success { background: rgba(145, 80, 46, 0.08); color: var(--success-color); border-color: rgba(145, 80, 46, 0.2); }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      font-family: var(--font-sans);
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      border: 1px solid transparent;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    .btn-primary {
      background: var(--primary-gradient);
      color: white;
      box-shadow: 0 4px 14px hsla(252, 100%, 67%, 0.2);
    }
    .btn-primary:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }
    .actions { display: flex; gap: 12px; }
    .toast {
      position: fixed;
      bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(18, 22, 33, 0.9);
      border: 1px solid var(--border-color);
      padding: 12px 24px;
      border-radius: 10px;
      color: white;
      font-size: 0.9rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 9999;
    }
    .toast.show { transform: translateX(-50%) translateY(0); }
    ${style}
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  ${bodyContent}
  <div id="toast" class="toast">Content copied!</div>
  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }
    function copyText(val) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => showToast('Content copied!')).catch(() => showToast('Copy failed'));
      } else {
        const inp = document.createElement('textarea');
        inp.value = val; document.body.appendChild(inp); inp.select();
        try { document.execCommand('copy'); showToast('Content copied!'); } catch(e) { showToast('Copy failed'); }
        document.body.removeChild(inp);
      }
    }
  </script>
</body>
</html>`;
}

function redirectHtmlPage(url) {
  return htmlPage(
    'Redirecting...',
    `<div class="card" style="text-align: center; max-width: 500px;">
      <a href="/" class="logo" style="justify-content: center;">⚡ Edge<span>Link</span></a>
      <div id="loadingState">
        <div class="spinner"></div>
        <h2 style="font-weight: 700; margin-bottom: 8px;">Redirecting...</h2>
        <p style="font-size: 0.9rem; color: var(--text-secondary);">Security check and redirect in progress</p>
        <div class="url-text">${escapeHtml(url)}</div>
      </div>
      <div id="errorState" class="hidden">
        <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
        <h2 style="color: var(--danger-color); font-weight: 800; margin-bottom: 12px;">Destination unreachable</h2>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;">We tried to connect but the destination appears to be unavailable.</p>
        <div class="url-text" style="background: rgba(255, 69, 58, 0.04); border-color: rgba(255, 69, 58, 0.15); color: var(--text-primary);">${escapeHtml(url)}</div>
        <div class="actions" style="margin-top: 24px; display: flex; gap: 12px;">
          <a href="${url}" class="btn btn-primary">Force Continue</a>
          <a href="/" class="btn btn-secondary">Go Home</a>
        </div>
      </div>
    </div>
    <script>
      (function() {
        const targetUrl = ${JSON.stringify(url)};
        let resolved = false;
        function doRedirect() {
          if (resolved) return;
          resolved = true;
          window.location.replace(targetUrl);
        }
        function showError() {
          if (resolved) return;
          resolved = true;
          document.getElementById('loadingState').classList.add('hidden');
          document.getElementById('errorState').classList.remove('hidden');
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          showError();
        }, 2500);
        fetch(targetUrl, { mode: 'no-cors', signal: controller.signal })
          .then(() => {
            clearTimeout(timeoutId);
            doRedirect();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') return;
            showError();
          });
      })();
    </script>`,
    `
    .spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255, 255, 255, 0.08);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s ease-in-out infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .url-text {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--text-secondary);
      word-break: break-all;
      margin: 16px 0;
      text-align: left;
    }
    .hidden {
      display: none !important;
    }
    `
  );
}

async function updateClickWithRetry(kv, code, linkData, isLastView, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (isLastView) {
        await kv.delete(`link:${code}`);
      } else {
        await kv.put(`link:${code}`, JSON.stringify(linkData));
      }

      const trendDate = new Date().toISOString().split('T')[0];
      const trendKey = `stats:clicks:${trendDate}`;
      const existing = await kv.get(trendKey);
      const trend = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : { date: trendDate, total: 0, links: 0 };
      trend.total = (trend.total || 0) + 1;
      await kv.put(trendKey, JSON.stringify(trend));

      return;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`Failed to update KV for ${code} after ${maxRetries} retries:`, err);
      } else {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }
  }
}

export default async function onRequest(context) {
  const { request, params } = context;
  const code = params.code;

  if (code === 'admin') {
    const urlObj = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${urlObj.origin}/admin.html`
      }
    });
  }

  if (!code) {
    const urlObj = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${urlObj.origin}/index.html`
      }
    });
  }

  const kv = getKV(context);

  const unavailableHtml = htmlPage(
    'Content Unavailable',
    `<div class="card" style="text-align: center;">
      <a href="/" class="logo" style="justify-content: center;">⚡ Edge<span>Link</span></a>
      <div style="font-size: 3.5rem; margin-bottom: 16px;"></div>
      <h2 style="color: var(--danger-color); font-weight: 800;">Content Unavailable</h2>
      <p>This link has expired, been deleted, or reached its view limit.</p>
      <a href="/" class="btn btn-secondary">Go Home</a>
    </div>`
  );

  try {
    const linkJson = await kv.get(`link:${code}`);

    if (!linkJson) {
      return new Response(unavailableHtml, {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    let linkData;
    try {
      linkData = typeof linkJson === 'string' ? JSON.parse(linkJson) : linkJson;
    } catch (e) {
      linkData = {
        type: 'url',
        url: linkJson,
        code,
        createdAt: new Date().toISOString(),
        clicks: 0
      };
    }

    if (linkData.expiresAt) {
      const expiresTime = new Date(linkData.expiresAt).getTime();
      if (Date.now() > expiresTime) {
        await kv.delete(`link:${code}`);
        return new Response(unavailableHtml, {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'no-store'
          }
        });
      }
    }

    const clicks = linkData.clicks || 0;
    const viewLimit = linkData.viewLimit;

    const isText = linkData.type === 'text';
    if (isText && viewLimit) {
      const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
      if (cookieHeader.includes(`viewed_${code}=true`)) {
        return new Response(unavailableHtml, {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        });
      }
    }

    const nextClicks = clicks + 1;
    const isLastView = viewLimit && (nextClicks >= viewLimit);

    const updateKVTask = updateClickWithRetry(kv, code, { ...linkData, clicks: nextClicks }, isLastView);

    if (context.waitUntil) {
      context.waitUntil(updateKVTask);
    }

    if (!linkData.type || linkData.type === 'url') {
      const redirectHtml = redirectHtmlPage(linkData.url);
      return new Response(redirectHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    let badgeHtml = '';
    if (viewLimit) {
      badgeHtml = `<span class="badge badge-success">Text Share</span>`;
    } else {
      badgeHtml = `<span class="badge badge-success">Text Share | Views: ${nextClicks} / Unlimited</span>`;
    }

    const textSharingHtml = htmlPage(
      'Text Share',
      `<div class="card">
        <a href="/" class="logo">⚡ Edge<span>Link</span></a>
        <h2>Text Share Content</h2>
        ${badgeHtml}
        <div class="content-box" id="noteContent">${escapeHtml(linkData.text || '')}</div>
        <div class="actions">
          <a href="/" class="btn btn-primary">Create My Share</a>
        </div>
      </div>
      ${viewLimit ? `
      <script>
        (function() {
          const key = 'viewed_' + ${JSON.stringify(code)};
          if (sessionStorage.getItem(key)) {
            document.body.innerHTML = \`<div class="bg-glow"></div>
            <div class="card" style="text-align: center;">
              <a href="/" class="logo" style="justify-content: center;">⚡ Edge<span>Link</span></a>
              <div style="font-size: 3.5rem; margin-bottom: 16px;"></div>
              <h2 style="color: var(--danger-color); font-weight: 800;">Content Unavailable</h2>
              <p>This link has expired, been deleted, or been securely destroyed.</p>
              <a href="/" class="btn btn-secondary">Go Home</a>
            </div>\`;
          } else {
            sessionStorage.setItem(key, 'true');
          }
        })();
      </script>
      ` : ''}`
    );

    const responseHeaders = {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    if (viewLimit) {
      responseHeaders['Set-Cookie'] = `viewed_${code}=true; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`;
    }

    return new Response(textSharingHtml, {
      status: 200,
      headers: responseHeaders
    });

  } catch (err) {
    const errorHtml = htmlPage(
      'System Error',
      `<div class="card" style="text-align: center;">
        <a href="/" class="logo" style="justify-content: center;">⚡ Edge<span>Link</span></a>
        <div style="font-size: 3.5rem; margin-bottom: 16px;">⚠️</div>
        <h2 style="color: var(--danger-color); font-weight: 800;">System Error</h2>
        <p>${err.message}</p>
        <a href="/" class="btn btn-secondary">Go Home</a>
      </div>`
    );
    return new Response(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      }
    });
  }
}