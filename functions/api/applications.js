import { json, errorResponse } from "../_lib.js";

const clean = value => String(value ?? "").trim().slice(0, 160);
export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error("database_not_configured");
    const body = await request.json();
    const item = { name: clean(body.name), city: clean(body.city), dept: clean(body.dept), year: clean(body.year), status: clean(body.status), phone: clean(body.phone).replace(/\D/g, "") };
    if (!item.name || !item.city || !item.dept || !item.status || !/^\d{10,15}$/.test(item.phone)) throw new Error("invalid_application");
    const id = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`;
    await env.DB.prepare("INSERT INTO applications (id, name, city, dept, year, member_status, phone, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'جديد', datetime('now'))").bind(id, item.name, item.city, item.dept, item.year, item.status, item.phone).run();
    return json({ ok: true, id }, 201);
  } catch (error) { return errorResponse(error); }
}
export function onRequestOptions() { return new Response(null, { status: 204 }); }
