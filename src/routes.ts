import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { DAILY_QUOTA, IP_SALT } from "./config";
import { hashStr, signalId } from "./glitch";
import { writeTransmission } from "./openrouter";
import { checkQuota, saveTransmission, getFeed, getStats } from "./supabase";

function ipHashOf(ip: string): string {
  return createHash("sha256").update(ip + "|" + IP_SALT).digest("hex").slice(0, 32);
}

function cleanInput(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u001F\u007F]/g, " ") // strip control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    ok: true,
    name: "CLAWTIFACT API",
    message: "feed it anything.",
    ts: Date.now(),
  }));

  app.get("/health", async () => ({ ok: true }));

  // POST /transmit  { input: string }  ->  one-of-one transmission
  app.post("/transmit", async (req, reply) => {
    const body = (req.body ?? {}) as { input?: unknown };
    const input = cleanInput(body.input);
    const iph = ipHashOf(req.ip || "0.0.0.0");

    const quota = await checkQuota(iph, DAILY_QUOTA);
    if (!quota.allowed) {
      return reply.code(429).send({ ok: false, error: "daily quota reached", remaining: 0 });
    }

    const seed = hashStr(input || "clawtifact");
    const signal = signalId(seed);
    const { lines, source } = await writeTransmission(input, seed);

    const saved = await saveTransmission({
      signal_id: signal,
      seed,
      input,
      lines,
      source,
      ip_hash: iph,
    });

    return reply.send({
      ok: true,
      id: saved?.id ?? null,
      signal,
      seed,
      input,
      lines,
      source,
      remaining: quota.remaining,
    });
  });

  // GET /feed?limit=24  ->  recent public transmissions
  app.get("/feed", async (req) => {
    const q = (req.query ?? {}) as { limit?: string };
    const limit = Math.max(1, Math.min(Number(q.limit) || 24, 50));
    const items = await getFeed(limit);
    return { ok: true, count: items.length, items };
  });

  // GET /stats  ->  total transmissions
  app.get("/stats", async () => {
    const s = await getStats();
    return { ok: true, ...s };
  });
}
