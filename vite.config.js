import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  preview: {
    host: true,
    port: 4173,
    allowedHosts: [".trycloudflare.com", "localhost", "127.0.0.1"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // allow the 3.4MB Cantonese dictionary
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.dictionaryapi\.dev\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "dict-api", expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/.*\.wiktionary\.org\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "wiktionary", expiration: { maxEntries: 500, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/api\.urbandictionary\.com\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "urbandict", expiration: { maxEntries: 300, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@tesseract\.js-data|tesseract\.js|tesseract\.js-core)\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "tesseract", expiration: { maxEntries: 30, maxAgeSeconds: 2592000 } },
          },
        ],
      },
      manifest: {
        name: "Vocab Vault",
        short_name: "Vault",
        description: "Collect and review vocabulary across languages. Auto-fetched dictionary definitions, flashcard review, offline support.",
        theme_color: "#6c5ce7",
        background_color: "#0f0f1a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});