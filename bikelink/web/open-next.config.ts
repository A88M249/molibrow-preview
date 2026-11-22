import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// The whole site is pre-rendered at build time; the Worker only reads those pages from its static assets.
export default defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });
