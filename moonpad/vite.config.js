import { resolve } from "path";
import { defineConfig } from "vite";

const dropLabels = process.env.NODE_ENV === "development" ? [] : ["DEV"];

export default defineConfig({
  esbuild: {
    dropLabels,
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Moonpad-Monaco",
      fileName: "moonpad-monaco",
    },
    rollupOptions: {
      external: ["monaco-editor-core"],
      output: {
        globals: {
          "monaco-editor-core": "monaco",
        },
      },
    },
  },
});
