import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export interface User {
  passwordHash: string;
  role: "free" | "pro";
  generationsLeft: number;
  proExpires: string | null; // ISO date or null
  createdAt: string;
  isAdmin?: boolean;        // admin/moderator flag
  totalGenerations?: number; // all-time carousel count (incremented on each allowed generation)
}

export async function getUser(login: string): Promise<User | null> {
  return redis.get<User>(`user:${login}`);
}

export async function setUser(login: string, data: User) {
  await redis.set(`user:${login}`, data);
}

export async function checkProExpiry(login: string, user: User): Promise<User> {
  if (user.role === "pro" && user.proExpires) {
    const now = new Date();
    const expires = new Date(user.proExpires);
    if (now >= expires) {
      user.role = "free";
      user.generationsLeft = 5;
      user.proExpires = null;
      await setUser(login, user);
    }
  }
  return user;
}

export function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Admin-Key");
}
