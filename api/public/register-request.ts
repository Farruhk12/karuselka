import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, setCors } from "../_db";

export interface RegisterRequest {
  id: string;
  phone: string;
  telegram: string;
  createdAt: string;
  read?: boolean;
}

const HASH_KEY = "register-requests";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { phone, telegram } = req.body || {};
  if (!phone && !telegram) return res.status(400).json({ error: "Укажите телефон или Telegram" });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item: RegisterRequest = {
    id,
    phone: (phone || "").trim(),
    telegram: (telegram || "").trim().replace(/^@/, ""),
    createdAt: new Date().toISOString(),
  };

  // Save to Redis hash (id → JSON)
  await redis.hset(HASH_KEY, { [id]: JSON.stringify(item) });

  // Optional: send Telegram notification to admin
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (botToken && chatId) {
    const parts: string[] = ["📋 *Новая заявка на регистрацию*"];
    if (item.phone) parts.push(`📱 Телефон: ${item.phone}`);
    if (item.telegram) parts.push(`💬 Telegram: @${item.telegram}`);
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: parts.join("\n"), parse_mode: "Markdown" }),
      });
    } catch (_) {
      // Telegram fail is non-critical — request is already saved
    }
  }

  return res.status(200).json({ ok: true });
}
