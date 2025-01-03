import * as moonbitMode from '@moonbit/moonpad-monaco'
import lspWorker from '@moonbit/moonpad-monaco/lsp-server.js?worker'
import mooncWorker from '@moonbit/moonpad-monaco/moonc-worker.js?worker'
import wasmUrl from '@moonbit/moonpad-monaco/onig.wasm?url'
import * as monaco from 'monaco-editor-core'
import editorWorker from 'monaco-editor-core/esm/vs/editor/editor.worker?worker'
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
  let a = 1
  let b = 2
  let c = add(a, b)
  println(c)
  for i = 0; i < 10; i = i + 1 {
    let d = add(c, i)
    println(d)
  }
}
`,
  'moonbit',
  monaco.Uri.file('/a.mbt'),
)

monaco.editor.create(document.getElementById('app')!, { model })

const trace = moonbitMode.traceCommandFactory()

model.onDidChangeContent(async () => {
  const stdout = await trace(monaco.Uri.file('/a.mbt').toString())
  console.log(stdout)
})
