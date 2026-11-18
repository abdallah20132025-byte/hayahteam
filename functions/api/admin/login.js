import { json, makeSession, sessionCookie, errorResponse } from "../../_lib.js";
export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) throw new Error("admin_secrets_not_configured");
    const body = await request.json();
    if (String(body.password || "") !== env.ADMIN_PASSWORD) throw new Error("invalid_password");
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(await makeSession(env)) });
  } catch (error) { return errorResponse(error); }
}
