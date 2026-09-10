import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",

  server: {
    host: "127.0.0.1",
    port: 5173,

    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      },

      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: "dist/client",
    emptyOutDir: true
  }
});