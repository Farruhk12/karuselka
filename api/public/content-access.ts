import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../_db";
import { loadContentAccess } from "../_contentAccess";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cfg = await loadContentAccess();
  return res.status(200).json(cfg);
}
