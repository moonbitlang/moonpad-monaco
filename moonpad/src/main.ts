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
pub fn add(a: Int, b: Int) -> Int {
  a + b
}
`,
  "moonbit",
);

function lineTransformStream() {
  let buffer = "";
  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? buffer;
      for (const line of lines) {
        controller.enqueue(line);
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(buffer);
      }
    },
  });
}

model.onDidChangeContent(async () => {
  const content = model.getValue();
  const result = await moon.compile({
    libContents: [content],
    testContents: [
      `
test {
  println(@lib.add(1, 2))
}
    `,
    ],
  });
  switch (result.kind) {
    case "success": {
      const wasm = result.wasm;
      const stream = await moon.test(wasm);
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
      const wasm = result.wasm;
      const stream = await moon.run(wasm);
      stream
        .pipeThrough(new TextDecoderStream("utf-16"))
        .pipeThrough(lineTransformStream())
        .pipeTo(
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
