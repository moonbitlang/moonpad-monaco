import * as lsp from 'vscode-languageserver-protocol'
import * as monaco from 'monaco-editor-core'

interface Adaptor<Lsp, Monaco> {
  from(m: Monaco, ...args: any[]): Lsp
  to(l: Lsp, ...args: any[]): Monaco
}

export const rangeAdaptor: Adaptor<lsp.Range, monaco.IRange> = {
  from(range: monaco.IRange): lsp.Range {
    return {
      start: {
        line: range.startLineNumber - 1,
        character: range.startColumn - 1,
      },
      end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
    }
  },
  to(range: lsp.Range): monaco.IRange {
    return {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.character + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.character + 1,
    }
  },
}

export const contentChangeAdaptor: Adaptor<
  lsp.TextDocumentContentChangeEvent,
  monaco.editor.IModelContentChange
> = {
  from: function (
    m: monaco.editor.IModelContentChange,
  ): lsp.TextDocumentContentChangeEvent {
    return {
      range: rangeAdaptor.from(m.range),
      text: m.text,
    }
  },
  to: function (
    _l: lsp.TextDocumentContentChangeEvent,
  ): monaco.editor.IModelContentChange {
    throw new Error('Function not implemented.')
  },
}

const severityMap = {
  [lsp.DiagnosticSeverity.Error]: monaco.MarkerSeverity.Error,
  [lsp.DiagnosticSeverity.Warning]: monaco.MarkerSeverity.Warning,
  [lsp.DiagnosticSeverity.Information]: monaco.MarkerSeverity.Info,
  [lsp.DiagnosticSeverity.Hint]: monaco.MarkerSeverity.Hint,
}

export const diagnosticAdaptor: Adaptor<
  lsp.Diagnostic,
  monaco.editor.IMarkerData
> = {
  from: function (_m: monaco.editor.IMarkerData): lsp.Diagnostic {
    throw new Error('Function not implemented.')
  },
  to: function (diag: lsp.Diagnostic): monaco.editor.IMarkerData {
    return {
      startLineNumber: diag.range.start.line + 1,
      startColumn: diag.range.start.character + 1,
      endLineNumber: diag.range.end.line + 1,
      endColumn: diag.range.end.character + 1,
      message: diag.message,
      severity: severityMap[diag.severity ?? lsp.DiagnosticSeverity.Error],
    }
  },
}

export const positionAdaptor: Adaptor<lsp.Position, monaco.Position> = {
  from: function (m: monaco.Position): lsp.Position {
    return {
      line: m.lineNumber - 1,
      character: m.column - 1,
    }
  },
  to: function (l: lsp.Position): monaco.Position {
    return new monaco.Position(l.line + 1, l.character + 1)
  },
}

const completionTriggerKindMap = {
  [monaco.languages.CompletionTriggerKind.Invoke]:
    lsp.CompletionTriggerKind.Invoked,
  [monaco.languages.CompletionTriggerKind.TriggerCharacter]:
    lsp.CompletionTriggerKind.TriggerCharacter,
  [monaco.languages.CompletionTriggerKind.TriggerForIncompleteCompletions]:
    lsp.CompletionTriggerKind.TriggerForIncompleteCompletions,
}

export const completionContextAdaptor: Adaptor<
  lsp.CompletionContext,
  monaco.languages.CompletionContext
> = {
  from: function (
    context: monaco.languages.CompletionContext,
  ): lsp.CompletionContext {
    return {
      triggerCharacter: context.triggerCharacter,
      triggerKind: completionTriggerKindMap[context.triggerKind],
    }
  },
  to: function (_l: lsp.CompletionContext): monaco.languages.CompletionContext {
    throw new Error('Function not implemented.')
  },
}

const markupAdaptor: Adaptor<lsp.MarkupContent, monaco.IMarkdownString> = {
  from: function (_m: monaco.IMarkdownString): lsp.MarkupContent {
    throw new Error('Function not implemented.')
  },
  to: function (markup: lsp.MarkupContent): monaco.IMarkdownString {
    return {
      value: markup.value,
    }
  },
}

const textEditAdaptor: Adaptor<
  lsp.TextEdit,
  monaco.editor.ISingleEditOperation
> = {
  from: function (_m: monaco.editor.ISingleEditOperation): lsp.TextEdit {
    throw new Error('Function not implemented.')
  },
  to: function (edit: lsp.TextEdit): monaco.editor.ISingleEditOperation {
    return {
      range: rangeAdaptor.to(edit.range),
      text: edit.newText,
    }
  },
}

const completionItemKindMap = {
  [lsp.CompletionItemKind.Text]: monaco.languages.CompletionItemKind.Text,
  [lsp.CompletionItemKind.Method]: monaco.languages.CompletionItemKind.Method,
  [lsp.CompletionItemKind.Function]:
    monaco.languages.CompletionItemKind.Function,
  [lsp.CompletionItemKind.Constructor]:
    monaco.languages.CompletionItemKind.Constructor,
  [lsp.CompletionItemKind.Field]: monaco.languages.CompletionItemKind.Field,
  [lsp.CompletionItemKind.Variable]:
    monaco.languages.CompletionItemKind.Variable,
  [lsp.CompletionItemKind.Class]: monaco.languages.CompletionItemKind.Class,
  [lsp.CompletionItemKind.Interface]:
    monaco.languages.CompletionItemKind.Interface,
  [lsp.CompletionItemKind.Module]: monaco.languages.CompletionItemKind.Module,
  [lsp.CompletionItemKind.Property]:
    monaco.languages.CompletionItemKind.Property,
  [lsp.CompletionItemKind.Unit]: monaco.languages.CompletionItemKind.Unit,
  [lsp.CompletionItemKind.Value]: monaco.languages.CompletionItemKind.Value,
  [lsp.CompletionItemKind.Enum]: monaco.languages.CompletionItemKind.Enum,
  [lsp.CompletionItemKind.Keyword]: monaco.languages.CompletionItemKind.Keyword,
  [lsp.CompletionItemKind.Snippet]: monaco.languages.CompletionItemKind.Snippet,
  [lsp.CompletionItemKind.Color]: monaco.languages.CompletionItemKind.Color,
  [lsp.CompletionItemKind.File]: monaco.languages.CompletionItemKind.File,
  [lsp.CompletionItemKind.Reference]:
    monaco.languages.CompletionItemKind.Reference,
  [lsp.CompletionItemKind.Folder]: monaco.languages.CompletionItemKind.Folder,
  [lsp.CompletionItemKind.EnumMember]:
    monaco.languages.CompletionItemKind.EnumMember,
  [lsp.CompletionItemKind.Constant]:
    monaco.languages.CompletionItemKind.Constant,
  [lsp.CompletionItemKind.Struct]: monaco.languages.CompletionItemKind.Struct,
  [lsp.CompletionItemKind.Event]: monaco.languages.CompletionItemKind.Event,
  [lsp.CompletionItemKind.Operator]:
    monaco.languages.CompletionItemKind.Operator,
  [lsp.CompletionItemKind.TypeParameter]:
    monaco.languages.CompletionItemKind.TypeParameter,
}

const completionItemAdaptor: Adaptor<
  lsp.CompletionItem,
  monaco.languages.CompletionItem
> = {
  from: function (_m: monaco.languages.CompletionItem): lsp.CompletionItem {
    throw new Error('Function not implemented.')
  },
  to: function (
    item: lsp.CompletionItem,
    range: monaco.IRange,
  ): monaco.languages.CompletionItem {
    const kind = completionItemKindMap[item.kind ?? lsp.CompletionItemKind.Text]
    const insertText = item.insertText ?? item.label
    const documentation = item.documentation
      ? lsp.MarkupContent.is(item.documentation)
        ? markupAdaptor.to(item.documentation)
        : item.documentation
      : undefined
    const additionalTextEdits = item.additionalTextEdits
      ? item.additionalTextEdits.map(textEditAdaptor.to)
      : undefined
    return {
      ...item,
      kind,
      insertText,
      documentation,
      range,
      additionalTextEdits,
      command: undefined,
    }
  },
}

export const completionListAdaptor: Adaptor<
  lsp.CompletionList | lsp.CompletionItem[] | null,
  monaco.languages.CompletionList
> = {
  from: function (
    _m: monaco.languages.CompletionList,
  ): lsp.CompletionList | lsp.CompletionItem[] | null {
    throw new Error('Function not implemented.')
  },
  to: function (
    completions: lsp.CompletionList | lsp.CompletionItem[] | null,
    range: monaco.IRange,
  ): monaco.languages.CompletionList {
    if (completions === null) return { suggestions: [] }
    const items = Array.isArray(completions) ? completions : completions.items
    return {
      suggestions: items.map(i => completionItemAdaptor.to(i, range)),
    }
  },
}
