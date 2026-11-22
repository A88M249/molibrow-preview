import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db.js";
import { adminRoutes } from "./routes/admin.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { productRoutes } from "./routes/products.js";
import { webhookRoutes } from "./routes/webhooks.js";

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });
  await app.register(cors, { origin: config.corsOrigins });
  await app.register(rateLimit, { global: false });
  await app.register(productRoutes);
  // Checkout creates orders and calls payment providers: limit it per IP.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 20, timeWindow: "1 minute" });
    await scope.register(checkoutRoutes);
  });
  await app.register(adminRoutes);
  await app.register(webhookRoutes); // own scope: raw-body parser stays local
  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true };
  });
  return app;
}
