export async function fetchJson(url, { timeout = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; SOS-App/1.0)" },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Upstream request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function jsonResponse(body, status = 200, cacheSeconds = 0) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (cacheSeconds > 0) {
    headers["Cache-Control"] = "public, max-age=60";
    headers["Netlify-CDN-Cache-Control"] = `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(err) {
  console.error(err);
  return jsonResponse({ error: "Could not load data from the upstream provider. Please try again shortly." }, 502);
}
