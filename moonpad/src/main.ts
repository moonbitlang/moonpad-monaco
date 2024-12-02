import lspWorker from "@moonbit/analyzer/lsp-server?worker";
import * as monaco from "monaco-editor-core";
import editorWorker from "monaco-editor-core/esm/vs/editor/editor.worker?worker";
import * as moonbitMode from ".";
import mooncWorker from "../node_modules/@moonbit/moonc-worker/moonc-worker?worker";
import wasmUrl from "../node_modules/vscode-oniguruma/release/onig.wasm?url";
import "./styles.css";

moonbitMode.init({
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

monaco.editor.create(document.getElementById("app")!, {
  value: `
fn add(a: Int, b: Int) -> Int {
  a + b
}
fn main {
  println("hello")
  println(add(1, 2))
}`,
  language: "moonbit",
});

monaco.editor.create(document.getElementById("app2")!, {
  value: `fn main {
  println("hello")
}`,
  language: "moonbit",
});
