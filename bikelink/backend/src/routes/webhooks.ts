import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { markPaid } from "../orders.js";
import { stripe } from "../payments/stripe.js";
import { isVippsAuthorized } from "../payments/vipps.js";

export async function webhookRoutes(app: FastifyInstance) {
  // Stripe needs the exact raw bytes to verify the signature.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.post("/webhooks/stripe", async (req, reply) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        req.headers["stripe-signature"] as string,
        config.stripe.webhookSecret,
      );
    } catch {
      return reply.code(400).send({ error: "Bad signature" });
    }
    // Klarna and other delayed methods fire async_payment_succeeded later.
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const s = event.data.object;
      if (s.payment_status === "paid" && s.client_reference_id) await markPaid(s.client_reference_id);
    }
    return { received: true };
  });

  // Vipps calls this when a payment changes. We ignore the body and ask Vipps.
  app.post("/webhooks/vipps", async (req, reply) => {
    const ref = (JSON.parse((req.body as Buffer).toString()) as { reference?: string }).reference;
    if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return reply.code(400).send({ error: "Bad reference" });
    if (await isVippsAuthorized(ref)) await markPaid(ref);
    return { received: true };
  });
}
