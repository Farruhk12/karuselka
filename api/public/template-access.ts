import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../_db";
import { ALL_SLIDE_LAYOUT_IDS } from "../../src/templateCatalog";
import { loadContentAccess } from "../_contentAccess";

/** @deprecated Используйте GET /api/public/content-access — здесь только совместимость по шаблонам. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cfg = await loadContentAccess();
  const enabledLayoutIds = ALL_SLIDE_LAYOUT_IDS.filter((id) => cfg.layouts[id] !== "none");

  return res.status(200).json({ enabledLayoutIds });
}
