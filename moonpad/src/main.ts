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

const model = monaco.editor.createModel(
  `
pub fn solve(cards: Array[Int]) -> Int {
  let mut result = 0
  for card in cards {
    result = result ^ card
  }
  result
}
`,
  "moonbit",
);

model.onDidChangeContent(async () => {
  const content = model.getValue();
  const result = await moon.compile({
    libContents: [content],
    testContents: [
      `
test {
  assert_eq!(@lib.solve([1, 1, 2, 2, 3, 3, 4, 5, 5]), 4);
}
test {
  assert_eq!(@lib.solve([0, 1, 0, 1, 2]), 2);
}
test {
  assert_eq!(@lib.solve([7, 3, 3, 7, 10]), 10);
}
    `,
    ],
  });
  switch (result.kind) {
    case "success": {
      const js = result.js;
      const stream = await moon.test(js);
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
});

monaco.editor.create(document.getElementById("app")!, { model });

const model2 = monaco.editor.createModel(
  `fn main {
  println("hello")
}`,
  "moonbit",
);

model2.onDidChangeContent(async () => {
  const content = model2.getValue();
  const result = await moon.compile({
    libContents: [content],
  });
  switch (result.kind) {
    case "success": {
      const js = result.js;
      const stream = await moon.run(js);
      stream.pipeTo(
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
});

monaco.editor.create(document.getElementById("app2")!, { model: model2 });
