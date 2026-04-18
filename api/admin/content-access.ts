import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, getUser, setCors } from "../_db";
import { loadContentAccess, saveContentAccess } from "../_contentAccess";
import { normalizeContentAccess, type ContentAccessPayload } from "../../src/contentAccessCatalog";

async function checkAdmin(req: VercelRequest): Promise<boolean> {
  const key = req.headers["x-admin-key"];
  if (key === process.env.ADMIN_SECRET) return true;
  const auth = req.headers.authorization;
  const token = typeof auth === "string" ? auth.replace("Bearer ", "") : "";
  if (token) {
    const session = await redis.get<{ login: string }>(`session:${token}`);
    if (session) {
      const user = await getUser(session.login);
      if (user?.isAdmin) return true;
    }
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkAdmin(req))) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const cfg = await loadContentAccess();
    return res.status(200).json(cfg);
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    const parsed = normalizeContentAccess(body) as ContentAccessPayload;
    const anyLayout = Object.values(parsed.layouts).some((m) => m !== "none");
    if (!anyLayout) {
      return res.status(400).json({ error: "Нужен хотя бы один доступный шаблон (не «Скрыть для всех»)" });
    }
    const saved = await saveContentAccess(parsed);
    return res.status(200).json({ ok: true, ...saved });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
