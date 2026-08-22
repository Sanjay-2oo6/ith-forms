import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],

  tanstackStart: {
    server: { entry: "server" },
  },

  // Deploy target. Platform detection order:
  // 1. Explicit NITRO_PRESET env var (set by netlify.toml, render.yaml, or manual override)
  // 2. Detect platform from env vars (Netlify, Vercel, Render, etc.)
  // 3. Default to vercel for local dev
  nitro: {
    preset: process.env.NITRO_PRESET || 
            (process.env.NETLIFY === "true" ? "netlify" : undefined) ||
            (process.env.VERCEL ? "vercel" : undefined) ||
            (process.env.RENDER ? "node-server" : undefined) ||
            "vercel",
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