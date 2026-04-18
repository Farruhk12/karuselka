import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, getUser, checkProExpiry, setCors } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  const session = await redis.get<{ login: string }>(`session:${token}`);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const user = await getUser(session.login);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updated = await checkProExpiry(session.login, user);

  return res.status(200).json({
    login: session.login,
    role: updated.role,
    generationsLeft: updated.generationsLeft,
    proExpires: updated.proExpires,
    isAdmin: !!updated.isAdmin,
    totalGenerations: updated.totalGenerations ?? 0,
    createdAt: updated.createdAt,
  });
}
