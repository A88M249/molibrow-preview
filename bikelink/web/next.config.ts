import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
    formats: ["image/avif", "image/webp"],
  },
};
export default config;
