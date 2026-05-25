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

// Generate random short code of specific length
function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

export default async function onRequest(context) {
  const { request } = context;
  
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }), {
      status: 405,
      headers: corsHeaders()
    });
  }

  try {
    const body = await request.json();
    let { url, customCode } = body;

    // 1. Validate long URL
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required.' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    // Basic URL format validation
    url = url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      return new Response(JSON.stringify({ error: 'Invalid URL format. Must start with http:// or https://' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    const kv = getKV(context);
    let shortCode = '';

    // 2. Validate custom alias if provided
    if (customCode) {
      customCode = customCode.trim();
      // Length check and alphanumeric + dash/underscore check
      if (!/^[a-zA-Z0-9-_]{3,20}$/.test(customCode)) {
        return new Response(JSON.stringify({
          error: 'Custom alias must be 3-20 characters long and contain only alphanumeric characters, dashes, and underscores.'
        }), {
          status: 400,
          headers: corsHeaders()
        });
      }

      // Check if custom code already exists
      const existing = await kv.get(`link:${customCode}`);
      if (existing) {
        return new Response(JSON.stringify({ error: 'This custom alias is already in use.' }), {
          status: 409,
          headers: corsHeaders()
        });
      }
      shortCode = customCode;
    } else {
      // 3. Generate random code (with retry safety for collisions)
      let attempts = 0;
      let unique = false;
      while (!unique && attempts < 5) {
        shortCode = generateRandomCode(6);
        const existing = await kv.get(`link:${shortCode}`);
        if (!existing) {
          unique = true;
        }
        attempts++;
      }

      if (!unique) {
        return new Response(JSON.stringify({ error: 'Failed to generate a unique short code. Please try again.' }), {
          status: 500,
          headers: corsHeaders()
        });
      }
    }

    // Save to KV
    const createdAt = new Date().toISOString();
    const linkData = {
      url,
      code: shortCode,
      createdAt,
      clicks: 0,
      customCode: !!customCode
    };

    await kv.put(`link:${shortCode}`, JSON.stringify(linkData));

    // Get origin of requesting client to build shortUrl
    const urlObj = new URL(request.url);
    const shortUrl = `${urlObj.origin}/${shortCode}`;

    return new Response(JSON.stringify({
      success: true,
      code: shortCode,
      url,
      shortUrl,
      createdAt
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
