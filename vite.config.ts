import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Same as nginx prod: /img-proxy/{s3-host}/path → https://{s3-host}/path
      "/img-proxy": {
        target: "https://satescolar.s3.us-east-1.amazonaws.com",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/img-proxy\/[^/]+\.amazonaws\.com/, ""),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
