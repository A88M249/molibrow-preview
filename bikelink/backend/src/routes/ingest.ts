import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { ingestStockFile, senderAllowed } from "../stock-import.js";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Intake for stock files that arrive by email. The Cloudflare Email Worker (email-worker/) calls this with the CSV attachment.
 * Needs STOCK_INGEST_TOKEN and a non-empty STOCK_ALLOWED_SENDERS list, otherwise it stays off.
 */
export async function ingestRoutes(app: FastifyInstance) {
  app.post("/ingest/stock", { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    if (!config.stock.ingestToken || !config.stock.allowedSenders.length) return reply.code(404).send({ error: "Not found" });
    const given = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!same(given, config.stock.ingestToken)) return reply.code(401).send({ error: "Unauthorized" });
    const body = z.object({ filename: z.string().max(200).optional(), from: z.string().max(320), receivedAt: z.string().datetime({ offset: true }).optional(), csvBase64: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (!senderAllowed(body.data.from)) return reply.code(403).send({ error: "Sender not allowed" });
    const sent = body.data.receivedAt ? new Date(body.data.receivedAt) : new Date();
    // A date in the future (or absurdly old) would hide or double-count orders: fall back to "now".
    const asOf = sent.getTime() > Date.now() + 5 * 60_000 || sent.getTime() < Date.now() - 7 * 86_400_000 ? new Date() : sent;
    const result = await ingestStockFile({ content: Buffer.from(body.data.csvBase64, "base64"), filename: body.data.filename, source: "email", sender: body.data.from, asOf, autoApply: config.stock.autoApply });
    return reply.code(result.status === "failed" ? 422 : 202).send(result);
  });
}
