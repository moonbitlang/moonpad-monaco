import './styles.css'
import * as monaco from 'monaco-editor-core'
// import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor-core/esm/vs/editor/editor.worker?worker'
import './moonbit-mode'

// @ts-ignore
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

monaco.editor.setTheme('light-plus')

monaco.editor.create(document.getElementById('app')!, {
  value: `fn main {
  println("hello)
}`,
  language: 'moonbit',
})

monaco.editor.create(document.getElementById('app2')!, {
  value: `fn main {
  println("hello")
}`,
  language: 'moonbit',
})
