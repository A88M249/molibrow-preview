import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { productRoutes } from "./routes/products.js";
import { webhookRoutes } from "./routes/webhooks.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.siteUrl });
await app.register(productRoutes);
await app.register(checkoutRoutes);
await app.register(webhookRoutes); // own scope: raw-body parser stays local

app.get("/health", async () => ({ ok: true }));

await app.listen({ port: config.port, host: "0.0.0.0" });
