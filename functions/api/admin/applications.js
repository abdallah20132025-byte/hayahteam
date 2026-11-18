import { json, isAdmin, errorResponse } from "../../_lib.js";
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  try {
    if (!env.DB) throw new Error("database_not_configured");
    const { results = [] } = await env.DB.prepare("SELECT id, name, city, dept, year, member_status AS memberStatus, phone, state, created_at AS createdAt FROM applications ORDER BY created_at DESC LIMIT 500").all();
    return json({ applications: results });
  } catch (error) { return errorResponse(error); }
}
