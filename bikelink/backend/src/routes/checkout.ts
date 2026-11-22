import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createOrder, priceCart, setProviderRef } from "../orders.js";
import { createStripeSession } from "../payments/stripe.js";
import { createVippsPayment } from "../payments/vipps.js";

const body = z.object({
  provider: z.enum(["stripe", "vipps"]),
  email: z.string().email(),
  delivery: z.discriminatedUnion("method", [
    z.object({ method: z.literal("home") }),
    z.object({ method: z.literal("dealer"), dealerId: z.string().min(1) }),
  ]).default({ method: "home" }),
  items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1),
});

export async function checkoutRoutes(app: FastifyInstance) {
  app.post("/checkout", async (req, reply) => {
    const input = body.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: input.error.flatten() });
    const { provider, email, items, delivery } = input.data;

    try {
      const lines = await priceCart(items);
      const order = await createOrder(provider, email, lines, delivery);

      if (provider === "stripe") {
        const s = await createStripeSession(order.id, email, lines);
        await setProviderRef(order.id, s.id);
        return { orderId: order.id, redirectUrl: s.url };
      }
      const p = await createVippsPayment(order.id, order.totalOre);
      return { orderId: order.id, redirectUrl: p.url };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });
}
