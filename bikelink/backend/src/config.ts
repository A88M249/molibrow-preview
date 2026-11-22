function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  siteUrl: need("SITE_URL"),
  databaseUrl: need("DATABASE_URL"),
  stripe: {
    secretKey: need("STRIPE_SECRET_KEY"),
    webhookSecret: need("STRIPE_WEBHOOK_SECRET"),
  },
  vipps: {
    baseUrl: need("VIPPS_BASE_URL"),
    clientId: need("VIPPS_CLIENT_ID"),
    clientSecret: need("VIPPS_CLIENT_SECRET"),
    subscriptionKey: need("VIPPS_SUBSCRIPTION_KEY"),
    msn: need("VIPPS_MSN"),
  },
};
