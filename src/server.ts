import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { PORT, ALLOWED_ORIGINS } from "./config";
import { registerRoutes } from "./routes";

async function main(): Promise<void> {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, {
    origin(origin, cb) {
      // allow server-to-server / curl (no Origin header) and any allow-listed origin
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ["GET", "POST"],
  });

  // burst protection (the per-day cap lives in the /transmit handler via Supabase)
  await app.register(rateLimit, {
    max: 30,
    timeWindow: "1 minute",
  });

  await registerRoutes(app);

  try {
    // host 0.0.0.0 is required on Railway; PORT is injected by the platform
    const addr = await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`CLAWTIFACT API listening on ${addr}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
