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
pub fn add(a: Int, b: Int) -> Int {
  a + b
}
`,
  'moonbit',
)

model.onDidChangeContent(async () => {
  const content = model.getValue()
  const result = await moon.compile({
    libContents: [content],
    testContents: [
      `
test {
  println(@lib.add(1, 2))
}
    `,
    ],
  })
  switch (result.kind) {
    case 'success': {
      const js = result.js
      const stream = await moon.test(js)
      stream.pipeTo(
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

const model2 = monaco.editor.createModel(
  `fn main {
  println("hello")
}`,
  'moonbit',
)

model2.onDidChangeContent(async () => {
  const content = model2.getValue()
  const result = await moon.compile({
    libContents: [content],
  })
  switch (result.kind) {
    case 'success': {
      const js = result.js
      const stream = await moon.run(js)
      stream.pipeTo(
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

monaco.editor.create(document.getElementById('app2')!, { model: model2 })
