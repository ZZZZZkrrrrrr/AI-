import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("lucide-react") || id.includes("lucide")) return "vendor-icons";
          if (id.includes("xlsx")) return "vendor-xlsx";
          return "vendor";
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["zkraiflow.top", "www.zkraiflow.top"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true
      }
    }
  }
});
