import Stripe from "stripe";
import { config } from "../config.js";
import type { PricedLine } from "../orders.js";

export const stripe = new Stripe(config.stripe.secretKey);

/**
 * Card + Klarna via Stripe Checkout. We don't list payment_method_types:
 * Stripe shows whatever is enabled in the dashboard (card, Klarna, ...).
 */
export async function createStripeSession(orderId: string, email: string, lines: PricedLine[]) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    client_reference_id: orderId,
    line_items: lines.map((l) => ({
      quantity: l.quantity,
      price_data: { currency: "nok", unit_amount: l.priceOre, product_data: { name: l.name } },
    })),
    success_url: `${config.siteUrl}/order/${orderId}?paid=1`,
    cancel_url: `${config.siteUrl}/cart`,
  });
  return { id: session.id, url: session.url! };
}
