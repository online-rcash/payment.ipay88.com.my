addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const ALLOWED_ORIGINS = [
  'https://www.rcash.my',
  'https://www.r-cash.my',
  'https://rcash.my',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const USERS = new Map();
const LOANS = new Map();

function getOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : 'https://www.rcash.my';
}

function jsonResponse(body, status = 200, request) {
  const origin = getOrigin(request);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    }
  });
}

function createId(prefix) {
  const random = crypto.getRandomValues(new Uint32Array(4));
  return `${prefix}_${Array.from(random).map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function parseJson(request) {
  return request.text().then(text => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Invalid JSON body');
    }
  });
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    const origin = getOrigin(request);
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      }
    });
  }

  try {
    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true, service: 'rcash-worker' }, 200, request);
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      const body = await parseJson(request);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const fullName = String(body.name || body.fullName || '').trim();

      if (!email || !password || !fullName) {
        return jsonResponse({ message: 'Missing required fields' }, 400, request);
      }

      if (USERS.has(email)) {
        return jsonResponse({ message: 'User already exists' }, 409, request);
      }

      const userId = createId('user');
      const user = {
        id: userId,
        name: fullName,
        email,
        password,
        kycStatus: 'Unverified',
        createdAt: new Date().toISOString()
      };

      USERS.set(email, user);

      return jsonResponse({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, kycStatus: user.kycStatus },
        token: createId('token')
      }, 201, request);
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await parseJson(request);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = USERS.get(email);

      if (!user || user.password !== password) {
        return jsonResponse({ message: 'Invalid email or password' }, 401, request);
      }

      return jsonResponse({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          kycStatus: user.kycStatus
        },
        token: createId('token')
      }, 200, request);
    }

    if (url.pathname === '/api/loan/apply' && request.method === 'POST') {
      const body = await parseJson(request);
      const amount = Number(body.amount || 0);
      const tenure = Number(body.tenure || 0);
      const userId = body.userId || body.applicantId || 'guest';

      if (!amount || !tenure) {
        return jsonResponse({ message: 'Loan amount and tenure are required' }, 400, request);
      }

      const applicationId = createId('loan');
      const application = {
        applicationId,
        userId,
        amount,
        tenure,
        monthlyEstimate: Number((amount / Math.max(tenure, 1)).toFixed(2)),
        status: 'Submitted',
        createdAt: new Date().toISOString(),
        summary: body.summary || null
      };

      LOANS.set(applicationId, application);

      return jsonResponse({
        success: true,
        applicationId,
        status: application.status,
        monthlyEstimate: application.monthlyEstimate
      }, 201, request);
    }

    if (url.pathname === '/api/loan/status' && request.method === 'GET') {
      const userId = url.searchParams.get('userId');
      const records = [];

      for (const loan of LOANS.values()) {
        if (!userId || loan.userId === userId) {
          records.push({
            applicationId: loan.applicationId,
            userId: loan.userId,
            amount: loan.amount,
            tenure: loan.tenure,
            status: loan.status,
            monthlyEstimate: loan.monthlyEstimate,
            createdAt: loan.createdAt
          });
        }
      }

      return jsonResponse({ success: true, items: records }, 200, request);
    }

    return jsonResponse({ message: 'Not found' }, 404, request);
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || 'Unexpected server error'
    }, 500, request);
  }
}
