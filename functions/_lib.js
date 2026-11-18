const COOKIE_NAME = "hayah_admin";
const MAX_SITE_BYTES = 1_800_000;

const fallbackSite = {
  t: {}, img: { logo: "", hero: "", dev: "" }, social: { fb: "", tt: "", ig: "" },
  joinUrl: "", ach: [], gal: [], news: [], wa: "", fs: ""
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

export function corsHeaders() {
  return { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
}

export function emptySite() {
  return structuredClone ? structuredClone(fallbackSite) : JSON.parse(JSON.stringify(fallbackSite));
}

export function normalizeSite(input) {
  if (!input || typeof input !== "object") throw new Error("invalid_site_data");
  const site = { ...emptySite(), ...input };
  site.t = { ...fallbackSite.t, ...(input.t || {}) };
  site.img = { ...fallbackSite.img, ...(input.img || {}) };
  site.social = { ...fallbackSite.social, ...(input.social || {}) };
  for (const key of ["ach", "gal", "news"]) site[key] = Array.isArray(input[key]) ? input[key] : [];
  const serialized = JSON.stringify(site);
  if (new TextEncoder().encode(serialized).length > MAX_SITE_BYTES) throw new Error("site_too_large");
  return site;
}

export async function getSite(env) {
  if (!env.DB) return null;
  const row = await env.DB.prepare("SELECT payload FROM site_state WHERE id = 1").first();
  return row?.payload ? JSON.parse(row.payload) : null;
}

export async function saveSite(env, input) {
  const site = normalizeSite(input);
  if (!env.DB) throw new Error("database_not_configured");
  await env.DB.prepare("INSERT INTO site_state (id, payload, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").bind(JSON.stringify(site)).run();
  return site;
}

function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64(value) { const s = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function key(env) { return crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_SESSION_SECRET || env.SESSION_SECRET || "change-this-session-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function signature(env, value) { return b64(await crypto.subtle.sign("HMAC", await key(env), new TextEncoder().encode(value))); }

export async function makeSession(env) {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  return `${b64(new TextEncoder().encode(payload))}.${await signature(env, payload)}`;
}

export async function isAdmin(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const raw = cookie.split(";").map(x => x.trim()).find(x => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return false;
  const [encoded, sig] = raw.split(".");
  if (!encoded || !sig) return false;
  try {
    const payload = new TextDecoder().decode(unb64(encoded));
    const issued = Number(payload.split(".")[0]);
    if (!Number.isFinite(issued) || Date.now() - issued > 1000 * 60 * 60 * 12) return false;
    return await crypto.subtle.verify("HMAC", await key(env), unb64(sig), new TextEncoder().encode(payload));
  } catch (_) { return false; }
}

export function sessionCookie(value, maxAge = 43200) { return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function clearSessionCookie() { return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function requireMethod(request, method) { return request.method === method ? null : json({ error: "method_not_allowed" }, 405, { allow: method }); }
export function errorResponse(error) {
  const known = new Set(["database_not_configured", "site_too_large", "invalid_site_data", "invalid_application", "invalid_password", "unauthorized", "admin_secrets_not_configured"]);
  const message = known.has(error?.message) ? error.message : "server_error";
  return json({ error: message }, message === "unauthorized" ? 401 : 500);
}

export { COOKIE_NAME };
