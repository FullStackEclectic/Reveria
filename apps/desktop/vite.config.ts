import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  envDir: "../..",
  resolve: {
    alias: {
      "@reveria/shared": path.resolve(__dirname, "../../packages/shared"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [".."],
    },
  },
  clearScreen: false,
});
