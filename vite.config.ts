import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Behaviour-neutral output optimisation: split stable third-party libraries
    // into their own long-lived, cacheable chunks. This shrinks the main app
    // bundle and lets the browser cache vendor code across deploys (only the
    // app chunk changes when our code changes). No source/runtime behaviour is
    // affected — same modules, just grouped differently at bundle time.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("scheduler") || /[\\/]react-dom[\\/]/.test(id) || /[\\/]react[\\/]/.test(id))
            return "vendor-react";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor"))
            return "vendor-charts";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("date-fns")) return "vendor-datefns";
        },
      },
    },
  },
}));
