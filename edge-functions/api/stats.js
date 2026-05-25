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

// CORS Headers helper
function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default async function onRequest(context) {
  const { request } = context;

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed. Use GET.' }), {
      status: 405,
      headers: corsHeaders()
    });
  }

  try {
    const urlObj = new URL(request.url);
    const code = urlObj.searchParams.get('code');

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code parameter.' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    const kv = getKV(context);
    const linkJson = await kv.get(`link:${code}`);

    if (!linkJson) {
      return new Response(JSON.stringify({ error: `Short link /${code} not found.` }), {
        status: 404,
        headers: corsHeaders()
      });
    }

    let linkData;
    try {
      linkData = typeof linkJson === 'string' ? JSON.parse(linkJson) : linkJson;
    } catch (e) {
      linkData = {
        url: linkJson,
        code,
        createdAt: new Date().toISOString(),
        clicks: 0
      };
    }

    // Return URL and clicks only (security safe)
    return new Response(JSON.stringify({
      success: true,
      code: linkData.code,
      url: linkData.url,
      clicks: linkData.clicks || 0,
      createdAt: linkData.createdAt
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
