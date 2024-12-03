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

model.onDidChangeContent(async () => {
  const content = model.getValue()
  const wasm = await moon.compile(content)
  const stream = await moon.run(wasm)
  stream.pipeThrough(new TextDecoderStream('utf-16')).pipeTo(
    new WritableStream({
      write(chunk) {
        console.log(chunk)
      },
    }),
  )
})

monaco.editor.create(document.getElementById('app')!, { model })

monaco.editor.create(document.getElementById('app2')!, {
  value: `fn main {
  println("hello")
}`,
  language: 'moonbit',
})
