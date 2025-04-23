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
