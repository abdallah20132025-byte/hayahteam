import { getSite, json, emptySite, errorResponse } from "../../_lib.js";

export async function onRequestGet({ env }) {
  try { return json({ site: (await getSite(env)) || emptySite() }); }
  catch (error) { return errorResponse(error); }
}
