here// Single Worker entry point — this is Cloudflare's current recommended structure
// (Worker + Static Assets), which replaced the older Pages Functions convention.
// With `assets` configured in wrangler.jsonc, Cloudflare tries to match the request
// against a static file FIRST; this script only runs for paths that don't match a
// file in /public — i.e. only our /api/* routes end up here. Static index.html and
// friends never reach this code at all.

function withDefensiveStream(upstream, providerNameArabic) {
  // A network blip partway through streaming must be caught here — an error that
  // happens after the Response is returned is outside any try/catch and would
  // otherwise kill the whole request instead of ending the stream cleanly.
  const upstreamReader = upstream.body.getReader();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        try {
          controller.enqueue(new TextEncoder().encode(
            `data: {"error":{"message":"انقطع الاتصال بـ ${providerNameArabic} أثناء الرد"}}\n\n`
          ));
        } catch (e) {}
        controller.close();
      }
    },
    cancel() {
      try { upstreamReader.cancel(); } catch (e) {}
    }
  });
}

async function proxyJsonApi({ apiKeyName, apiKey, url, buildHeaders, body, providerNameArabic }) {
  if (!apiKey) {
    return new Response(JSON.stringify({ error: `${apiKeyName} غير مضبوط في Environment Variables` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let upstream;
  try {
    upstream = await fetch(url, { method: 'POST', headers: buildHeaders(apiKey), body });
  } catch (err) {
    return new Response(JSON.stringify({ error: `تعذر الوصول لـ ${providerNameArabic}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
    });
  }

  return new Response(withDefensiveStream(upstream, providerNameArabic), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
}

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);

      if (pathname === '/api/health') {
        return new Response(JSON.stringify({
          groqConfigured: Boolean(env.GROQ_API_KEY),
          geminiConfigured: Boolean(env.GEMINI_API_KEY),
          openrouterConfigured: Boolean(env.OPENROUTER_API_KEY),
          cerebrasConfigured: Boolean(env.CEREBRAS_API_KEY)
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }

      const body = await request.text();

      if (pathname === '/api/groq') {
        return proxyJsonApi({
          apiKeyName: 'GROQ_API_KEY',
          apiKey: env.GROQ_API_KEY,
          url: 'https://api.groq.com/openai/v1/chat/completions',
          buildHeaders: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
          body,
          providerNameArabic: 'Groq'
        });
      }

      if (pathname === '/api/gemini') {
        return proxyJsonApi({
          apiKeyName: 'GEMINI_API_KEY',
          apiKey: env.GEMINI_API_KEY,
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`,
          buildHeaders: () => ({ 'Content-Type': 'application/json' }),
          body,
          providerNameArabic: 'Gemini'
        });
      }

      if (pathname === '/api/openrouter') {
        return proxyJsonApi({
          apiKeyName: 'OPENROUTER_API_KEY',
          apiKey: env.OPENROUTER_API_KEY,
          url: 'https://openrouter.ai/api/v1/chat/completions',
          buildHeaders: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://school-x.workers.dev',
            'X-Title': 'School X'
          }),
          body,
          providerNameArabic: 'OpenRouter'
        });
      }

      if (pathname === '/api/cerebras') {
        if (!env.CEREBRAS_API_KEY) {
          return new Response(JSON.stringify({ error: 'CEREBRAS_API_KEY غير مضبوط في Environment Variables' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        let upstream;
        try {
          upstream = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CEREBRAS_API_KEY}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/event-stream'
            },
            body
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'تعذر الوصول لـ Cerebras' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (!upstream.ok) {
          const text = await upstream.text();
          const looksLikeHtml = text.trim().startsWith('<');
          return new Response(JSON.stringify({
            error: looksLikeHtml
              ? 'Cerebras رفض الطلب على مستوى الشبكة (صفحة حجب وليست رد API)'
              : text.slice(0, 500)
          }), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(withDefensiveStream(upstream, 'Cerebras'), {
          status: upstream.status,
          headers: {
            'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'خطأ غير متوقع في السيرفر', detail: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
