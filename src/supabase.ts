import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "./config";

export const supa: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
        // Node < 22 has no global WebSocket; supabase-js realtime needs one at construct time
        // even though this server only uses the REST API. `ws` satisfies it.
        realtime: { transport: ws as unknown as never },
      })
    : null;

const TABLE = "clawtifact_transmissions";

export interface FeedItem {
  signal: string;
  input: string;
  lines: string[];
  source: string;
  created_at: string;
}

/** Increment today's per-IP counter and report whether the call is allowed. */
export async function checkQuota(
  ipHash: string,
  max: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (!supa) return { allowed: true, remaining: max }; // no DB in dev -> allow
  const { data, error } = await supa.rpc("clawtifact_check_quota", { p_ip: ipHash, p_max: max });
  if (error) {
    console.error("[quota]", error.message);
    return { allowed: true, remaining: max }; // fail open
  }
  const remaining = typeof data === "number" ? data : max;
  return { allowed: remaining >= 0, remaining: Math.max(0, remaining) };
}

export async function saveTransmission(row: {
  signal_id: string;
  seed: number;
  input: string;
  lines: string[];
  source: string;
  ip_hash: string;
}): Promise<{ id: string } | null> {
  if (!supa) return null;
  const { data, error } = await supa.from(TABLE).insert(row).select("id").single();
  if (error) {
    console.error("[save]", error.message);
    return null;
  }
  return data as { id: string };
}

export async function getFeed(limit: number): Promise<FeedItem[]> {
  if (!supa) return [];
  const { data, error } = await supa
    .from(TABLE)
    .select("signal_id, input, lines, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[feed]", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    signal: r.signal_id as string,
    input: r.input as string,
    lines: r.lines as string[],
    source: r.source as string,
    created_at: r.created_at as string,
  }));
}

export async function getStats(): Promise<{ total: number }> {
  if (!supa) return { total: 0 };
  const { count, error } = await supa.from(TABLE).select("*", { count: "exact", head: true });
  if (error) {
    console.error("[stats]", error.message);
    return { total: 0 };
  }
  return { total: count ?? 0 };
}
