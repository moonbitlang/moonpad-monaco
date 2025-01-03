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
    libUris: [monaco.Uri.file("/a.mbt").toString()],
    testUris: [monaco.Uri.file("/b.test.mbt").toString()],
    debugMain: true,
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
