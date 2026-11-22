import { randomUUID } from "node:crypto";
import { config } from "../config.js";

const v = config.vipps;

const baseHeaders = {
  "Ocp-Apim-Subscription-Key": v.subscriptionKey,
  "Merchant-Serial-Number": v.msn,
  "Vipps-System-Name": "bikelink",
  "Vipps-System-Version": "1.0.0",
};

async function accessToken(): Promise<string> {
  const res = await fetch(`${v.baseUrl}/accesstoken/get`, {
    method: "POST",
    headers: { ...baseHeaders, client_id: v.clientId, client_secret: v.clientSecret },
  });
  if (!res.ok) throw new Error(`Vipps token failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function call(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const res = await fetch(`${v.baseUrl}${path}`, {
    ...init,
    headers: {
      ...baseHeaders,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Vipps ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** The Vipps payment reference is our order id (must be 8-50 chars: a UUID fits). */
export async function createVippsPayment(orderId: string, totalOre: number) {
  const r = (await call("/epayment/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: "NOK", value: totalOre },
      paymentMethod: { type: "WALLET" },
      reference: orderId,
      userFlow: "WEB_REDIRECT",
      returnUrl: `${config.siteUrl}/order/${orderId}`,
      paymentDescription: "Bikelink order",
    }),
  })) as { redirectUrl: string };
  return { url: r.redirectUrl };
}

/** Ask Vipps directly, instead of trusting a webhook body. */
export async function isVippsAuthorized(orderId: string): Promise<boolean> {
  const r = (await call(`/epayment/v1/payments/${orderId}`)) as { state: string };
  return r.state === "AUTHORIZED";
}
