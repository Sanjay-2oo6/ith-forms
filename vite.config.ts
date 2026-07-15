import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],

  tanstackStart: {
    server: { entry: "server" },
  },

  // Deploy target. The base Lovable config defaults Nitro to
  // `cloudflare-module` (which outputs to `.output/`); we deploy to Netlify,
  // whose Nitro preset emits static assets to `dist/` plus a serverless
  // function in `.netlify/functions-internal/` — preserving the SSR shell and
  // src/server.ts (CSP headers + /health). Override-able via NITRO_PRESET so
  // other targets (e.g. `cloudflare-module`) stay reachable without a code change.
  nitro: {
    preset: process.env.NITRO_PRESET || "netlify",
  },

  // @ts-expect-error — server option is supported at runtime by lovable config
  server: {
    // Respect PORT when set; default to 3000
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    strictPort: false,

    // Allow access through ngrok
    host: "0.0.0.0",
    allowedHosts: true,
  },
});