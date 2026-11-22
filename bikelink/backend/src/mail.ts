import nodemailer from "nodemailer";
import { config } from "./config.js";
import { DEALER_NAMES } from "./dealers.js";
import { pool } from "./db.js";

const kr = (ore: number) => `${new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100)).replace(/ /g, " ")} kr`;

/** Sends the order confirmation. Does nothing (and never throws) if SMTP_URL is not configured. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  if (!config.mail.smtpUrl) return;
  try {
    const { rows: [o] } = await pool.query("SELECT email, total_ore, delivery_method, dealer_id FROM orders WHERE id = $1", [orderId]);
    const { rows: items } = await pool.query(
      "SELECT p.name, p.size, i.quantity, i.price_ore FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = $1", [orderId]);
    if (!o) return;
    const delivery = o.delivery_method === "dealer"
      ? `Henting hos forhandler: ${DEALER_NAMES[o.dealer_id] ?? o.dealer_id}. Forhandleren kontakter deg når sykkelen er klar.`
      : "Hjemlevering. Vi sender deg sporingsinformasjon når pakken er sendt.";
    const lines = items.map((i) => `- ${i.name}${i.size ? ` (${i.size})` : ""} × ${i.quantity}: ${kr(i.price_ore * i.quantity)}`).join("\n");
    await nodemailer.createTransport(config.mail.smtpUrl).sendMail({
      from: config.mail.from, to: o.email, subject: `Bestillingsbekreftelse – BikeLink (${orderId.slice(0, 8)})`,
      text: `Takk for bestillingen hos BikeLink!\n\n${lines}\n\nTotalt: ${kr(o.total_ore)} inkl. mva (frakt inkludert)\n\n${delivery}\n\nSpørsmål? Svar på denne e-posten eller ring +47 46 41 19 06.\n\nBikeLink AS – offisiell MMR-importør`,
    });
  } catch (err) {
    console.error("order email failed", orderId, err); // payment is already confirmed; an email failure must not break the webhook
  }
}
