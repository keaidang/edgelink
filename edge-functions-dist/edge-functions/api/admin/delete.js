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
export default async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed. Use DELETE or POST.' }), {
      status: 405,
      headers: corsHeaders()
    });
  }

  const authCheck = verifyAdminAuth(context);
  if (!authCheck.authorized) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: authCheck.status,
      headers: corsHeaders()
    });
  }

  try {
    const kv = getKV(context);
    let codes = [];

    const urlObj = new URL(request.url);
    const singleCode = urlObj.searchParams.get('code');
    if (singleCode) {
      codes.push(singleCode);
    }

    if (codes.length === 0) {
      try {
        const body = await request.clone().json();
        if (body.codes && Array.isArray(body.codes)) {
          codes = body.codes;
        } else if (body.code) {
          codes.push(body.code);
        }
      } catch (e) {
      }
    }

    if (codes.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing code or codes parameter.' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    const deletedList = [];
    const failedList = [];

    await Promise.all(
      codes.map(async (code) => {
        try {
          const existing = await kv.get(`link:${code}`);
          if (existing) {
            await kv.delete(`link:${code}`);
            deletedList.push(code);
          } else {
            failedList.push(code);
          }
        } catch (err) {
          failedList.push(code);
        }
      })
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully processed bulk deletion.`,
      deleted: deletedList,
      failed: failedList
    }), {
      status: 200,
      headers: corsHeaders()
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Internal Server Error: ${err.message}` }), {
      status: 500,
      headers: corsHeaders()
    });
  }
}