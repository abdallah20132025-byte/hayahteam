import { json, isAdmin, errorResponse } from "../../../_lib.js";
export async function onRequestPatch({ request, env, params }) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  try { const { state } = await request.json(); if (!["جديد", "قيد المراجعة", "تم التواصل", "مرفوض"].includes(state)) throw new Error("invalid_application"); await env.DB.prepare("UPDATE applications SET state = ? WHERE id = ?").bind(state, params.id).run(); return json({ ok: true }); } catch (error) { return errorResponse(error); }
}
export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  try { await env.DB.prepare("DELETE FROM applications WHERE id = ?").bind(params.id).run(); return json({ ok: true }); } catch (error) { return errorResponse(error); }
}
