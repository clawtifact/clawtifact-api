import "dotenv/config";

/** Railway injects PORT at runtime — never hardcode it in production. */
export const PORT = Number(process.env.PORT) || 8080;

export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";

export const DAILY_QUOTA = Number(process.env.DAILY_QUOTA) || 50;
export const IP_SALT = process.env.IP_SALT || "clawtifact-dev-salt";

/** CORS allow-list — include BOTH www and non-www. */
export const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://clawtifact.xyz,https://www.clawtifact.xyz,http://localhost:5500,http://127.0.0.1:5500"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
