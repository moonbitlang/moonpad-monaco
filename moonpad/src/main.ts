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

import * as monaco from "monaco-editor-core";
import editorWorker from "monaco-editor-core/esm/vs/editor/editor.worker?worker";
import * as moonbitMode from ".";
import mooncWorker from "../node_modules/@moonbit/moonc-worker/moonc-worker?worker";
import wasmUrl from "../node_modules/vscode-oniguruma/release/onig.wasm?url";
import "./styles.css";

const moon = moonbitMode.init({
  onigWasmUrl: wasmUrl,
  mooncWorkerFactory: () => new mooncWorker(),
});

// @ts-ignore
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

monaco.editor.setTheme("light-plus");

const model = monaco.editor.createModel(
  `
fn main {
  let a = 1
  let b = 2
  let c = a + b
  println(c)
}
`,
  "moonbit",
  monaco.Uri.file("/main.mbt"),
);

monaco.editor.create(document.getElementById("normal")!, { model });

const trace = moonbitMode.traceCommandFactory();

const traceModel = monaco.editor.createModel(
  `fn main {
  let a = 1
  let b = 2
  let c = a + b
  println(c)
}`,
  "moonbit",
  monaco.Uri.file("/trace.mbt"),
);

monaco.editor.create(document.getElementById("trace")!, {
  model: traceModel,
});

traceModel.onDidChangeContent(async () => {
  const stdout = await trace(traceModel.uri.toString());
  console.log(stdout);
});

model.onDidChangeContent(run);
void run();

async function run() {
  const result = await moon.runSingleFile({
    code: model.getValue(),
    filename: model.uri.path,
  });
  switch (result.kind) {
    case "success": {
      console.log(result.output);
      return;
    }
    case "error": {
      console.error(result.message);
    }
  }
}
