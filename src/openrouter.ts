import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "./config";
import { localTransmission, corrupt, mulberry32 } from "./glitch";

const SYSTEM = [
  "You are CLAWTIFACT, an AI glitch-transmission engine on Solana.",
  "A user feeds you a word, phrase, or feeling. You answer as if decoding a corrupted incoming signal.",
  "Reply with EXACTLY three short lines, each on its own line.",
  "No numbering, no bullet points, no quotation marks, no markdown, no preamble.",
  "Line 1: an eerie opening that treats the input as an incoming signal.",
  "Line 2: a cryptic aphorism about signal, noise, memory, pixels, or corruption (max 12 words).",
  'Line 3: a terse sign-off, e.g. "transmission holds." or "// end of frame".',
  "Voice: lowercase, terse, cyberpunk, a little ominous. Never cheerful. Never explain yourself.",
  "Total under 45 words. Never mention being an AI or a model. Never give advice or safety caveats.",
].join(" ");

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s>*\-\d.)]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}

export async function writeTransmission(
  input: string,
  seed: number
): Promise<{ lines: string[]; source: "model" | "fallback" }> {
  if (!OPENROUTER_API_KEY) {
    return { lines: localTransmission(input, seed), source: "fallback" };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // header values must be plain ASCII — non-ASCII (e.g. an em-dash) breaks ByteString validation
        "HTTP-Referer": "https://clawtifact.xyz",
        "X-Title": "CLAWTIFACT",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 220,
        temperature: 1.05,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `INPUT: ${input || "signal"}` },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error("[openrouter]", res.status, await safeText(res));
      return { lines: localTransmission(input, seed), source: "fallback" };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content ?? "";
    const lines = parseLines(text);
    if (lines.length < 1) {
      return { lines: localTransmission(input, seed), source: "fallback" };
    }
    // keep the signature glitch on the middle line, deterministically
    if (lines[1]) {
      const rnd = mulberry32((seed ^ 0x5bd1e995) >>> 0);
      lines[1] = corrupt(lines[1], rnd, 0.08);
    }
    return { lines, source: "model" };
  } catch (e: unknown) {
    console.error("[openrouter]", e instanceof Error ? e.message : e);
    return { lines: localTransmission(input, seed), source: "fallback" };
  }
}
