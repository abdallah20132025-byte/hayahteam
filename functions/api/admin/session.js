import { json, isAdmin } from "../../_lib.js";
export async function onRequestGet({ request, env }) { return isAdmin(request, env) ? json({ ok: true }) : json({ error: "unauthorized" }, 401); }
