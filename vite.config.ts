import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "/react-data-grid-benchmark/",
  plugins: [react()],
  build: {
    manifest: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: { demo: resolve(__dirname, "demo.html") }
    }
  }
});
