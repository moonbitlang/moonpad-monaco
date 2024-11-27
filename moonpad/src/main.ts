import * as monaco from "monaco-editor-core";
import editorWorker from "monaco-editor-core/esm/vs/editor/editor.worker?worker";
import "./moonbit-mode";
import "./styles.css";

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
