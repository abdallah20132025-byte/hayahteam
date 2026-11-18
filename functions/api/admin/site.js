import { json, isAdmin, getSite, saveSite, errorResponse } from "../../_lib.js";
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  try { return json({ site: await getSite(env) }); } catch (error) { return errorResponse(error); }
}
export async function onRequestPut({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  try { const body = await request.json(); return json({ ok: true, site: await saveSite(env, body.site) }); }
  catch (error) { return errorResponse(error); }
}
