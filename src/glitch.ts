/* ============================================================
   CLAWTIFACT — deterministic helpers (mirror of frontend glitch.js)
   Same input => same seed => same signal id, on server and client.
   ============================================================ */

export function hashStr(s: string): number {
  s = String(s);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function signalId(seed: number): string {
  return "0x" + (seed >>> 0).toString(16).toUpperCase().slice(0, 8);
}

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GLY = "█▓▒░▚▞◣◢╳※⌁∎";

export function corrupt(str: string, rnd: () => number, amt: number): string {
  return str
    .split("")
    .map((ch) => (ch !== " " && rnd() < amt ? GLY[Math.floor(rnd() * GLY.length)] : ch))
    .join("");
}

/** Used when OpenRouter is unset/unreachable — keeps /transmit always working. */
export function localTransmission(input: string, seed: number): string[] {
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const IN = (input || "signal").toUpperCase();
  const pick = (a: string[]) => a[Math.floor(rnd() * a.length)];
  const open = pick([
    "the signal found you.",
    "reality buffered, then broke.",
    "channel open. you fed it: " + IN + ".",
    "decoding " + IN + "…",
    "it was listening before you typed.",
  ]);
  const mid = pick([
    "pixels remember what you forget.",
    "every artifact is a confession.",
    "noise is just a louder kind of truth.",
    "the glitch was always the message.",
    "compression lied; the edges told on it.",
  ]);
  const close = pick([
    "transmission holds.",
    "do not adjust your set.",
    "the artifact persists.",
    "signal lost. meaning kept.",
    "// end of frame",
  ]);
  return [open, corrupt(mid, rnd, 0.1), close];
}
