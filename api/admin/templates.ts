import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, getUser, setCors } from "../_db";
import { ALL_SLIDE_LAYOUT_IDS } from "../../src/templateCatalog";
import { loadContentAccess, saveContentAccess } from "../_contentAccess";
import { migrateLayoutsFromLegacyEnabledList } from "../../src/contentAccessCatalog";

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

  const allowed = new Set(ALL_SLIDE_LAYOUT_IDS);

  if (req.method === "GET") {
    const cfg = await loadContentAccess();
    const enabledLayoutIds = ALL_SLIDE_LAYOUT_IDS.filter((id) => cfg.layouts[id] !== "none");
    return res.status(200).json({ enabledLayoutIds, allLayoutIds: ALL_SLIDE_LAYOUT_IDS });
  }

  if (req.method === "PUT") {
    const { enabledLayoutIds } = req.body || {};
    if (!Array.isArray(enabledLayoutIds)) {
      return res.status(400).json({ error: "enabledLayoutIds must be an array" });
    }
    const filtered = (enabledLayoutIds as unknown[])
      .filter((id): id is string => typeof id === "string" && allowed.has(id));
    const unique = [...new Set(filtered)];
    if (unique.length === 0) {
      return res.status(400).json({ error: "Нужен хотя бы один доступный шаблон" });
    }
    const cfg = await loadContentAccess();
    cfg.layouts = migrateLayoutsFromLegacyEnabledList(unique);
    const saved = await saveContentAccess(cfg);
    const out = ALL_SLIDE_LAYOUT_IDS.filter((id) => saved.layouts[id] !== "none");
    return res.status(200).json({ ok: true, enabledLayoutIds: out });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
