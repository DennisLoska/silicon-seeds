import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  root: "src/client",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3000",
      "/assets": "http://localhost:3000",
      "/jobs/stream": "http://localhost:3000",
      "/jobs": { target: "http://localhost:3000", changeOrigin: true },
      "/gallery": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
