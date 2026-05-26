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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// Auth Verification Helper
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

export default async function onRequest(context) {
  const { request } = context;

  // Handle preflight OPTIONS request
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

  // 1. Verify Admin credentials
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
    
    // Check search parameter first: e.g. /api/admin/delete?code=abc
    const urlObj = new URL(request.url);
    const singleCode = urlObj.searchParams.get('code');
    if (singleCode) {
      codes.push(singleCode);
    }

    // Try to parse JSON body
    if (codes.length === 0) {
      try {
        const body = await request.clone().json();
        if (body.codes && Array.isArray(body.codes)) {
          codes = body.codes;
        } else if (body.code) {
          codes.push(body.code);
        }
      } catch (e) {
        // Body reading failed (e.g. empty request)
      }
    }

    if (codes.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing code or codes parameter.' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    // 2. Perform deletions
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
