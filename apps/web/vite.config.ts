import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      "/auth": "http://localhost:3101",
      "/users": "http://localhost:3101",
      "/groups": "http://localhost:3101",
      "/expenses": "http://localhost:3101",
      "/settlements": "http://localhost:3101",
      "/monetization": "http://localhost:3101",
    },
  },
});
