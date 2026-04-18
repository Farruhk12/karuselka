import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, setCors } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "");
  if (token) await redis.del(`session:${token}`);

  return res.status(200).json({ ok: true });
}
