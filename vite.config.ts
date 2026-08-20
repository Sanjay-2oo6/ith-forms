import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],

  tanstackStart: {
    server: { entry: "server" },
  },

  // Deploy target. Defaults to the Vercel preset, but Nitro's own preset
  // resolution only falls back to NITRO_PRESET when `preset` is left
  // unset here — an explicit value in this config always wins. Reading
  // process.env.NITRO_PRESET explicitly lets netlify.toml's
  // NITRO_PRESET=netlify actually take effect on Netlify builds.
  nitro: {
    preset: process.env.NITRO_PRESET || "vercel",
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