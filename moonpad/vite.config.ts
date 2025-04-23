/*
 * Copyright 2025 International Digital Economy Academy
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs";
import { resolve } from "path";
import { defineConfig, Plugin } from "vite";
import dts from "vite-plugin-dts";

const dropLabels = process.env.NODE_ENV === "development" ? [] : ["DEV"];

const plugin: Plugin = {
  name: "copy-worker",
  writeBundle() {
    fs.copyFileSync(
      "node_modules/@moonbit/analyzer/lsp-server.js",
      "dist/lsp-server.js",
    );
    fs.copyFileSync(
      "node_modules/@moonbit/moonc-worker/moonc-worker.js",
      "dist/moonc-worker.js",
    );
    fs.copyFileSync(
      "node_modules/vscode-oniguruma/release/onig.wasm",
      "dist/onig.wasm",
    );
  },
};

export default defineConfig({
  plugins: [plugin, dts({ rollupTypes: true })],
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
