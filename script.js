// =====================================================
// GLOBAL STATE
// =====================================================
function buildCleanRoute(page, extraParams = {}) {
  const params = new URLSearchParams(extraParams);
  const sessionId =
    params.get('session') ||
    (
      window.crypto && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );

  params.set('session', sessionId);

  const cleanPath = `/${String(page).replace(/^\/+|\/+$/g, '')}/`;
  const url = new URL(cleanPath, window.location.origin);

  for (const [key, value] of params.entries()) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function navigateToCleanRoute(page, extraParams = {}) {
  window.location.assign(buildCleanRoute(page, extraParams));
}
