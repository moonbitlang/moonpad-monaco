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

import lspWorker from "@moonbit/analyzer/lsp-server?worker";
import * as monaco from "monaco-editor-core";
import editorWorker from "monaco-editor-core/esm/vs/editor/editor.worker?worker";
import * as moonbitMode from ".";
import mooncWorker from "../node_modules/@moonbit/moonc-worker/moonc-worker?worker";
import wasmUrl from "../node_modules/vscode-oniguruma/release/onig.wasm?url";
import "./styles.css";

const moon = moonbitMode.init({
  onigWasmUrl: wasmUrl,
  lspWorker: new lspWorker(),
  mooncWorkerFactory: () => new mooncWorker(),
});

// @ts-ignore
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

monaco.editor.setTheme("light-plus");

monaco.editor.createModel(`{}`, "json", monaco.Uri.file("/moon.pkg.json"));

const model = monaco.editor.createModel(
  `
fn solve(a: Int, b: Int) -> Int {
  println(a)
  println(b)
  a + b
}
`,
  "moonbit",
  monaco.Uri.file("/a.mbt"),
);

monaco.editor.create(document.getElementById("app")!, { model });

const model2 = monaco.editor.createModel(
  `test {
  inspect!(solve(1, 2), content="3")
}`,
  "moonbit",
  monaco.Uri.file("/b.test.mbt"),
);

monaco.editor.create(document.getElementById("app2")!, { model: model2 });

model.onDidChangeContent(run);
model2.onDidChangeContent(run);

async function run() {
  const result = await moon.compile({
    libInputs: [["a.mbt", model.getValue()]],
    testInputs: [["a_wbtest.mbt", model2.getValue()]],
    debugMain: false,
  });
  switch (result.kind) {
    case "success": {
      const js = result.js;
      const stream = moon.test(js);
      await stream.pipeTo(
        new WritableStream({
          write(chunk) {
            console.log(chunk);
          },
        }),
      );
      return;
    }
    case "error": {
      console.error(result.diagnostics);
    }
  }
}
