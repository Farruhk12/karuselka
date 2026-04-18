import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { redis, getUser, checkProExpiry, setCors } from "../_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: "Login and password required" });

  const user = await getUser(login);
  if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Неверный логин или пароль" });

  // Check if Pro expired
  const updated = await checkProExpiry(login, user);

  // Create session token
  const token = crypto.randomUUID();
  await redis.set(`session:${token}`, { login, createdAt: new Date().toISOString() }, { ex: 60 * 60 * 24 * 30 }); // 30 days TTL

  const profile = {
    login,
    role: updated.role,
    generationsLeft: updated.generationsLeft,
    proExpires: updated.proExpires,
    isAdmin: !!updated.isAdmin,
  };

  return res.status(200).json({ token, profile });
}
