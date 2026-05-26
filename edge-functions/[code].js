// Helper to get the KV namespace with fallbacks and local mock database support
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

  // Get request URL to detect local environment
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

// Beautiful stand-alone HTML response helper
function htmlPage(title, bodyContent, style = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - EdgeLink</title>
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
  <div id="toast" class="toast">复制成功！</div>
  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }
    function copyText(val) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => showToast('复制内容成功！')).catch(() => showToast('复制失败，请手动选择复制'));
      } else {
        const inp = document.createElement('textarea');
        inp.value = val; document.body.appendChild(inp); inp.select();
        try { document.execCommand('copy'); showToast('复制内容成功！'); } catch(e) { showToast('复制失败'); }
        document.body.removeChild(inp);
      }
    }
  </script>
</body>
</html>`;
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
    '内容不可用',
    `<div class="card" style="text-align: center;">
      <a href="/" class="logo" style="justify-content: center;">⚡ Edge<span>Link</span></a>
      <div style="font-size: 3.5rem; margin-bottom: 16px;">📭</div>
      <h2 style="color: var(--danger-color); font-weight: 800;">内容不可用</h2>
      <p>此链接已失效、被删除，或已达到查看次数上限被安全销毁。</p>
      <a href="/" class="btn btn-secondary">返回首页</a>
    </div>`
  );

  try {
    // Fetch data from KV
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

    // Parse JSON metadata
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

    const clicks = linkData.clicks || 0;
    const viewLimit = linkData.viewLimit;
    const nextClicks = clicks + 1;
    const isLastView = viewLimit && (nextClicks >= viewLimit);

    // Asynchronously update KV (increment click or delete if expired)
    const updateKVTask = (async () => {
      try {
        if (isLastView) {
          // Delete from KV immediately to protect privacy and prevent storage overflow
          await kv.delete(`link:${code}`);
        } else {
          linkData.clicks = nextClicks;
          await kv.put(`link:${code}`, JSON.stringify(linkData));
        }
      } catch (err) {
        console.error(`Failed to update KV for ${code}:`, err);
      }
    })();

    if (context.waitUntil) {
      context.waitUntil(updateKVTask);
    }

    // Handle URL Redirection
    if (!linkData.type || linkData.type === 'url') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': linkData.url,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Handle Text Sharing Render
    let badgeHtml = '';
    if (viewLimit) {
      if (isLastView) {
        badgeHtml = `<span class="badge badge-danger">🚨 最后一次查看 | 此内容已被销毁</span>`;
      } else {
        badgeHtml = `<span class="badge badge-info">⚠️ 阅后即焚限制 | 剩余查看次数: ${viewLimit - nextClicks}</span>`;
      }
    } else {
      badgeHtml = `<span class="badge badge-success">📝 文字分享 | 累计查看次数: ${nextClicks}</span>`;
    }

    const textSharingHtml = htmlPage(
      '文字分享',
      `<div class="card">
        <a href="/" class="logo">⚡ Edge<span>Link</span></a>
        <h2>文字分享内容</h2>
        ${badgeHtml}
        <div class="content-box" id="noteContent">${escapeHtml(linkData.text || '')}</div>
        <div class="actions">
          <button class="btn btn-primary" onclick="copyText(document.getElementById('noteContent').textContent)">复制文字内容</button>
          <a href="/" class="btn btn-secondary">创建我的分享</a>
        </div>
      </div>`
    );

    return new Response(textSharingHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err) {
    const errorHtml = htmlPage(
      '系统错误',
      `<div class="card" style="text-align: center;">
        <a href="/" class="logo" style="justify-content: center;">⚡ Edge<span>Link</span></a>
        <div style="font-size: 3.5rem; margin-bottom: 16px;">⚠️</div>
        <h2 style="color: var(--danger-color); font-weight: 800;">系统错误</h2>
        <p>${err.message}</p>
        <a href="/" class="btn btn-secondary">返回首页</a>
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

// Simple HTML Escaper
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
