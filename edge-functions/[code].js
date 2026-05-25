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

export default async function onRequest(context) {
  const { request, params } = context;
  const code = params.code;

  if (!code) {
    // If no code, redirect to home
    const urlObj = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${urlObj.origin}/index.html`
      }
    });
  }

  const kv = getKV(context);

  try {
    // Fetch data from KV
    const linkJson = await kv.get(`link:${code}`);

    if (!linkJson) {
      // Short code not found: Redirect to index page with error query parameter
      const urlObj = new URL(request.url);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${urlObj.origin}/index.html?error=notfound&code=${encodeURIComponent(code)}`,
          'Cache-Control': 'no-store'
        }
      });
    }

    // Parse JSON metadata
    let linkData;
    try {
      linkData = typeof linkJson === 'string' ? JSON.parse(linkJson) : linkJson;
    } catch (e) {
      // In case metadata is stored as raw long URL string in KV (legacy/simple setup fallback)
      linkData = {
        url: linkJson,
        code,
        createdAt: new Date().toISOString(),
        clicks: 0
      };
    }

    // Asynchronously increment click count in the background using context.waitUntil
    const incrementClicksTask = (async () => {
      try {
        linkData.clicks = (linkData.clicks || 0) + 1;
        await kv.put(`link:${code}`, JSON.stringify(linkData));
      } catch (err) {
        console.error(`Failed to update click count for ${code}:`, err);
      }
    })();

    if (context.waitUntil) {
      context.waitUntil(incrementClicksTask);
    }

    // Return instant 302 redirect response
    return new Response(null, {
      status: 302,
      headers: {
        'Location': linkData.url,
        // Disable cache on the redirect so browser hit requests always reach the Edge Function to count clicks
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    // Fallback: system error redirecting to index with error details
    const urlObj = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${urlObj.origin}/index.html?error=system&message=${encodeURIComponent(err.message)}`
      }
    });
  }
}
