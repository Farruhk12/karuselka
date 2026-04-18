import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { redis, getUser, setUser, setCors } from "../_db";
import type { User } from "../_db";

async function checkAdmin(req: VercelRequest): Promise<boolean> {
  // Method 1: secret key header
  const key = req.headers["x-admin-key"];
  if (key === process.env.ADMIN_SECRET) return true;
  // Method 2: Bearer token from admin user
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

  // GET — list users (scan keys)
  if (req.method === "GET") {
    const keys: string[] = [];
    let cursor: number = 0;
    do {
      const result = await redis.scan(cursor, { match: "user:*", count: 100 });
      cursor = Number(result[0]);
      keys.push(...(result[1] as string[]));
    } while (cursor !== 0);

    const users = [];
    for (const key of keys) {
      const login = key.replace("user:", "");
      const data = await redis.get<User>(key);
      if (data) users.push({ login, role: data.role, generationsLeft: data.generationsLeft, proExpires: data.proExpires, createdAt: data.createdAt, isAdmin: !!data.isAdmin });
    }
    return res.status(200).json({ users });
  }

  // POST — create user
  if (req.method === "POST") {
    const { login, password, role = "free", proDays = 0 } = req.body || {};
    if (!login || !password) return res.status(400).json({ error: "login and password required" });

    const existing = await getUser(login);
    if (existing) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const proExpires = role === "pro" && proDays > 0
      ? new Date(Date.now() + proDays * 86400000).toISOString()
      : null;

    const user: User = {
      passwordHash,
      role: role === "pro" ? "pro" : "free",
      generationsLeft: role === "pro" ? 0 : 5,
      proExpires,
      createdAt: new Date().toISOString(),
    };
    await setUser(login, user);
    return res.status(201).json({ ok: true, login, role: user.role, proExpires });
  }

  // PUT — update user
  if (req.method === "PUT") {
    const { login, role, proDays, generationsLeft, password, isAdmin } = req.body || {};
    if (!login) return res.status(400).json({ error: "login required" });

    const user = await getUser(login);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    if (role) user.role = role;
    if (typeof generationsLeft === "number") user.generationsLeft = generationsLeft;
    if (typeof isAdmin === "boolean") user.isAdmin = isAdmin;
    if (role === "pro" && proDays) {
      user.proExpires = new Date(Date.now() + proDays * 86400000).toISOString();
    }
    await setUser(login, user);
    return res.status(200).json({ ok: true });
  }

  // DELETE — delete user
  if (req.method === "DELETE") {
    const { login } = req.body || {};
    if (!login) return res.status(400).json({ error: "login required" });
    await redis.del(`user:${login}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
