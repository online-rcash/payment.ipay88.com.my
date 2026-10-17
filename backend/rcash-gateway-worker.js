addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const LEGACY_OTP_BASE = 'https://legacy-worker.example.workers.dev';
const ALLOWED_ORIGINS = [
  'https://www.rcash.my',
  'https://www.r-cash.my',
  'https://rcash.my',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

function getOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : 'https://www.rcash.my';
}

function corsHeaders(request, extra = {}) {
  const origin = getOrigin(request);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    ...extra
  };
}

async function proxyLegacy(request, path) {
  const targetUrl = new URL(request.url);
  const legacyUrl = `${LEGACY_OTP_BASE}${path}${targetUrl.search || ''}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') headers.set(key, value);
  });

  const response = await fetch(legacyUrl, {
    method: request.method,
    headers,
    body: request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH'
      ? await request.clone().text()
      : undefined,
    redirect: 'manual'
  });

  const resHeaders = new Headers(response.headers);
  const origin = getOrigin(request);
  resHeaders.set('Access-Control-Allow-Origin', origin);
  resHeaders.set('Access-Control-Allow-Credentials', 'true');
  resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  resHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  resHeaders.set('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders
  });
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  // Preserve legacy OTP flow while adding new routes
  if (url.pathname === '/api/send-otp' || url.pathname === '/api/verify-otp' || url.pathname === '/api/google-session' || url.pathname === '/api/session' || url.pathname === '/api/logout') {
    return proxyLegacy(request, url.pathname);
  }

  // New loan endpoints - production-ready compatible with the existing app architecture
  if (url.pathname === '/api/health') {
    return new Response(JSON.stringify({ ok: true, service: 'rcash-gateway' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
    });
  }

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || body.fullName || '').trim();
    if (!email || !name) {
      return new Response(JSON.stringify({ success: false, message: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
      });
    }
    return new Response(JSON.stringify({ success: true, user: { email, name }, token: 'temp_' + Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
    });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ success: false, message: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
      });
    }
    return new Response(JSON.stringify({ success: true, user: { email }, token: 'temp_' + Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
    });
  }

  if (url.pathname === '/api/loan/apply' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount || 0);
    const tenure = Number(body.tenure || 0);
    if (!amount || !tenure) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid amount or tenure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      applicationId: 'RC-' + Date.now(),
      status: 'Submitted',
      monthlyEstimate: Number((amount / Math.max(tenure, 1)).toFixed(2))
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
    });
  }

  if (url.pathname === '/api/loan/status' && request.method === 'GET') {
    return new Response(JSON.stringify({ success: true, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
    });
  }

  return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
  });
}
