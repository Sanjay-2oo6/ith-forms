import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],

  tanstackStart: {
    server: { entry: "server" },
  },

  // Deploy target. Use Node preset as it's more compatible across platforms.
  // Can be overridden via NITRO_PRESET environment variable.
  nitro: {
    preset: process.env.NITRO_PRESET || "node",
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