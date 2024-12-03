import lspWorker from '../node_modules/@moonbit/analyzer/lsp-server?worker'
import * as monaco from 'monaco-editor-core'
import editorWorker from 'monaco-editor-core/esm/vs/editor/editor.worker?worker'
import * as moonbitMode from 'moonpad-monaco'
import mooncWorker from '../node_modules/@moonbit/moonc-worker/moonc-worker?worker'
import wasmUrl from '../node_modules/vscode-oniguruma/release/onig.wasm?url'
import './styles.css'

const moon = moonbitMode.init({
  onigWasmUrl: wasmUrl,
  lspWorker: new lspWorker(),
  mooncWorkerFactory: () => new mooncWorker(),
})

// @ts-ignore
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

monaco.editor.setTheme('light-plus')

const model = monaco.editor.createModel(
  `
fn add(a: Int, b: Int) -> Int {
  a + b
}
fn main {
  println("hello")
  println(add(1, 2))
}`,
  'moonbit',
)

function lineTransformStream() {
  let buffer = ''
  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? buffer
      for (const line of lines) {
        controller.enqueue(line)
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(buffer)
      }
    },
  })
}

model.onDidChangeContent(async () => {
  const content = model.getValue()
  const result = await moon.compile(content)
  switch (result.kind) {
    case 'success': {
      const wasm = result.wasm
      const stream = await moon.run(wasm)
      stream
        .pipeThrough(new TextDecoderStream('utf-16'))
        .pipeThrough(lineTransformStream())
        .pipeTo(
          new WritableStream({
            write(chunk) {
              console.log(chunk)
            },
          }),
        )
      return
    }
    case 'error': {
      console.error(result.diagnostics)
    }
  }
})

monaco.editor.create(document.getElementById('app')!, { model })

monaco.editor.create(document.getElementById('app2')!, {
  value: `fn main {
  println("hello")
}`,
  language: 'moonbit',
})
