import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, getUser, setUser, checkProExpiry, setCors } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  const session = await redis.get<{ login: string }>(`session:${token}`);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const user = await getUser(session.login);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updated = await checkProExpiry(session.login, user);

  // Pro → unlimited, but still count total
  if (updated.role === "pro") {
    updated.totalGenerations = (updated.totalGenerations ?? 0) + 1;
    await setUser(session.login, updated);
    return res.status(200).json({ allowed: true, generationsLeft: -1, totalGenerations: updated.totalGenerations });
  }

  // Free → check limit
  if (updated.generationsLeft <= 0) {
    return res.status(200).json({ allowed: false, generationsLeft: 0 });
  }

  updated.generationsLeft -= 1;
  updated.totalGenerations = (updated.totalGenerations ?? 0) + 1;
  await setUser(session.login, updated);

  return res.status(200).json({ allowed: true, generationsLeft: updated.generationsLeft, totalGenerations: updated.totalGenerations });
}
