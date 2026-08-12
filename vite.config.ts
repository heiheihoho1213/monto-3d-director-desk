import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  assetsInclude: ["**/*.fbx", "**/*.obj", "**/*.glb"],
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib-entry.ts"),
      name: "Monto3DDirectorDesk",
      formats: ["es"],
      fileName: "monto-3d-director-desk",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "zustand",
        "lucide-react",
        "camera-controls",
        "three-stdlib",
        /^three\//,
        /^@react-three\//,
        /^three-stdlib\//,
      ],
      output: {
        exports: "named",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "style.css";
          }
          return "assets/[name][extname]";
        },
      },
    },
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    maxWorkers: 1,
    setupFiles: "./src/test/setup.ts",
  },
});
