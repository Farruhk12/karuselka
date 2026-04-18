import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, setCors } from "../_db";
import type { RegisterRequest } from "../public/register-request";

const HASH_KEY = "register-requests";

async function isAdmin(req: VercelRequest): Promise<boolean> {
  // Check admin key header
  const key = req.headers["x-admin-key"];
  if (key && key === process.env.ADMIN_SECRET) return true;
  // Check Bearer token (admin users)
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "");
  if (!token) return false;
  const session = await redis.get<{ login: string }>(`session:${token}`);
  if (!session) return false;
  const user = await redis.get<{ isAdmin?: boolean }>(`user:${session.login}`);
  return !!user?.isAdmin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const authed = await isAdmin(req);
  if (!authed) return res.status(403).json({ error: "Forbidden" });

  // GET — list all requests
  if (req.method === "GET") {
    const raw = await redis.hgetall<Record<string, string>>(HASH_KEY);
    if (!raw) return res.status(200).json({ requests: [] });
    const requests: RegisterRequest[] = Object.values(raw)
      .map(v => (typeof v === "string" ? JSON.parse(v) : v) as RegisterRequest)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.status(200).json({ requests });
  }

  // DELETE — remove a request by id
  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });
    await redis.hdel(HASH_KEY, id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
