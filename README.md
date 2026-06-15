# CLAWTIFACT API

Server-side transmission engine for **CLAWTIFACT** ($ARTI). Takes any text, returns a one-of-one
*transmission* written by **Claude Haiku 4.5** (via OpenRouter), stores it in **Supabase**, and serves a
public feed + stats. The glitch **art** stays client-side (deterministic canvas); this service owns the
**message**.

- **Stack:** Fastify + TypeScript · Supabase (Singapore) · OpenRouter (Claude Haiku 4.5) · Railway
- **Resilient:** if OpenRouter or Supabase aren't configured/reachable, `/transmit` falls back to a
  deterministic local transmission and still returns 200 — it never hard-fails.
- **Deterministic ids:** the seed + `signal` id are computed with the same FNV-1a hash as the frontend,
  so `hash("diamond hands")` matches on both sides.

## Endpoints

| Method | Path         | Body / Query        | Returns |
|--------|--------------|---------------------|---------|
| GET    | `/`          | —                   | service banner |
| GET    | `/health`    | —                   | `{ ok: true }` |
| POST   | `/transmit`  | `{ "input": "..." }`| `{ ok, id, signal, seed, input, lines[3], source, remaining }` |
| GET    | `/feed`      | `?limit=24` (max 50)| `{ ok, count, items[] }` recent transmissions |
| GET    | `/stats`     | —                   | `{ ok, total }` |

`source` is `"model"` (OpenRouter) or `"fallback"` (local). `/transmit` is capped per IP per day
(`DAILY_QUOTA`) and globally rate-limited to 30 req/min/IP. IPs are SHA-256 hashed with `IP_SALT` —
never stored raw.

## Local dev

```bash
cp .env.example .env      # fill in the values
npm install
npm run dev               # tsx watch, http://localhost:8080
```

It runs without Supabase/OpenRouter (quota fails open, transmissions use the local fallback) so you can
develop the wiring before keys are ready.

## Supabase

1. Create a project (Singapore region).
2. SQL editor → run [`db/schema.sql`](db/schema.sql) (tables, RLS, and the `clawtifact_check_quota` RPC).
3. Project Settings → API → copy the **Project URL** and the **service_role** key into
   `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`. The service key is server-only — never ship it to the browser.

## OpenRouter

1. Get a key at <https://openrouter.ai/keys> → `OPENROUTER_API_KEY`.
2. `OPENROUTER_MODEL` defaults to `anthropic/claude-haiku-4.5` — set it to the current Haiku 4.5 slug if it differs.

## Deploy to Railway

1. Push this folder to GitHub, then **New Project → Deploy from repo** on Railway.
2. Nixpacks auto-detects Node, runs `npm run build`, then `npm start`.
3. Add the env vars from `.env.example` — **do not set `PORT`** (Railway injects it; the server reads it
   and binds `0.0.0.0`).
4. In `ALLOWED_ORIGINS`, include **both** `https://clawtifact.xyz` **and** `https://www.clawtifact.xyz`.
5. You'll get a URL like `https://clawtifact-api-production.up.railway.app`.

## Connect the frontend

Add one line to `js/config.js` (empty `""` keeps the built-in local engine):

```js
window.CLAWTIFACT = {
  // ...existing fields...
  API_BASE: "https://clawtifact-api-production.up.railway.app"
};
```

Then have the engine pull the message from the API, keeping the canvas instant and falling back to the
local transmission if the API is unset or down. Drop this helper into the inline script of
`index.html` / `playground.html`:

```js
async function fetchTransmission(input, seed){
  const base = (window.CLAWTIFACT && window.CLAWTIFACT.API_BASE) || "";
  if (base){
    try {
      const r = await fetch(base + "/transmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });
      if (r.ok){ const d = await r.json(); if (d && d.lines && d.lines.length) return { lines: d.lines, id: d.signal }; }
    } catch (e) {}
  }
  const t = window.Glitch.buildTransmission(input, seed); // local fallback
  return { lines: t.lines, id: t.id };
}
```

…and in `transmit()`, after `Glitch.renderArt(...)`, swap the local message build for:

```js
fetchTransmission(state.input, state.seed).then(t => Glitch.typeOut(msg, t.lines, t.id));
```

## Notes

- **Single-source CA** stays on the frontend (`config.js`); this API doesn't need the contract address.
- **ASCII headers only** — outbound request headers (e.g. `X-Title`) are plain ASCII on purpose; a
  non-ASCII character such as an em-dash breaks header (ByteString) validation.
- **RLS** is enabled on both tables with no anon policies; the API uses the service role (which bypasses
  RLS) and the public feed is served *through* the API, not directly from the browser.
