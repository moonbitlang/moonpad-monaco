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

import * as monaco from "monaco-editor-core";
import * as lsp from "vscode-languageserver-protocol";

interface Adaptor<Lsp, Monaco> {
  from(m: Monaco, ...args: any[]): Lsp;
  to(l: Lsp, ...args: any[]): Monaco;
}

export const rangeAdaptor: Adaptor<lsp.Range, monaco.IRange> = {
  from(range: monaco.IRange): lsp.Range {
    return {
      start: {
        line: range.startLineNumber - 1,
        character: range.startColumn - 1,
      },
      end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
    };
  },
  to(range: lsp.Range): monaco.IRange {
    return {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.character + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.character + 1,
    };
  },
};

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
    };
  },
  to: function (
    _l: lsp.TextDocumentContentChangeEvent,
  ): monaco.editor.IModelContentChange {
    throw new Error("Function not implemented.");
  },
};

const severityMap = {
  [lsp.DiagnosticSeverity.Error]: monaco.MarkerSeverity.Error,
  [lsp.DiagnosticSeverity.Warning]: monaco.MarkerSeverity.Warning,
  [lsp.DiagnosticSeverity.Information]: monaco.MarkerSeverity.Info,
  [lsp.DiagnosticSeverity.Hint]: monaco.MarkerSeverity.Hint,
};

export const diagnosticAdaptor: Adaptor<
  lsp.Diagnostic,
  monaco.editor.IMarkerData
> = {
  from: function (_m: monaco.editor.IMarkerData): lsp.Diagnostic {
    throw new Error("Function not implemented.");
  },
  to: function (diag: lsp.Diagnostic): monaco.editor.IMarkerData {
    return {
      startLineNumber: diag.range.start.line + 1,
      startColumn: diag.range.start.character + 1,
      endLineNumber: diag.range.end.line + 1,
      endColumn: diag.range.end.character + 1,
      message: diag.message,
      severity: severityMap[diag.severity ?? lsp.DiagnosticSeverity.Error],
    };
  },
};

export const positionAdaptor: Adaptor<lsp.Position, monaco.Position> = {
  from: function (m: monaco.Position): lsp.Position {
    return {
      line: m.lineNumber - 1,
      character: m.column - 1,
    };
  },
  to: function (l: lsp.Position): monaco.Position {
    return new monaco.Position(l.line + 1, l.character + 1);
  },
};

const completionTriggerKindMap = {
  [monaco.languages.CompletionTriggerKind.Invoke]:
    lsp.CompletionTriggerKind.Invoked,
  [monaco.languages.CompletionTriggerKind.TriggerCharacter]:
    lsp.CompletionTriggerKind.TriggerCharacter,
  [monaco.languages.CompletionTriggerKind.TriggerForIncompleteCompletions]:
    lsp.CompletionTriggerKind.TriggerForIncompleteCompletions,
};

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
    };
  },
  to: function (_l: lsp.CompletionContext): monaco.languages.CompletionContext {
    throw new Error("Function not implemented.");
  },
};

const markupAdaptor: Adaptor<lsp.MarkupContent, monaco.IMarkdownString> = {
  from: function (m: monaco.IMarkdownString): lsp.MarkupContent {
    return {
      kind: lsp.MarkupKind.Markdown,
      value: m.value,
    };
  },
  to: function (l: lsp.MarkupContent): monaco.IMarkdownString {
    return l;
  },
};

const markedStringAdaptor: Adaptor<lsp.MarkedString, monaco.IMarkdownString> = {
  from: function (m: monaco.IMarkdownString): lsp.MarkedString {
    return m.value;
  },
  to: function (l: lsp.MarkedString): monaco.IMarkdownString {
    return {
      value: typeof l === "string" ? l : l.value,
    };
  },
};

const singleEditAdaptor: Adaptor<
  lsp.TextEdit,
  monaco.editor.ISingleEditOperation
> = {
  from: function (_m: monaco.editor.ISingleEditOperation): lsp.TextEdit {
    throw new Error("Function not implemented.");
  },
  to: function (edit: lsp.TextEdit): monaco.editor.ISingleEditOperation {
    return {
      range: rangeAdaptor.to(edit.range),
      text: edit.newText,
    };
  },
};

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
};

const completionItemAdaptor: Adaptor<
  lsp.CompletionItem,
  monaco.languages.CompletionItem
> = {
  from: function (_m: monaco.languages.CompletionItem): lsp.CompletionItem {
    throw new Error("Function not implemented.");
  },
  to: function (
    item: lsp.CompletionItem,
    range: monaco.IRange,
  ): monaco.languages.CompletionItem {
    const kind =
      completionItemKindMap[item.kind ?? lsp.CompletionItemKind.Text];
    const insertText = item.insertText ?? item.label;
    const documentation = item.documentation
      ? lsp.MarkupContent.is(item.documentation)
        ? markupAdaptor.to(item.documentation)
        : item.documentation
      : undefined;
    const additionalTextEdits = item.additionalTextEdits
      ? item.additionalTextEdits.map(singleEditAdaptor.to)
      : undefined;
    return {
      ...item,
      kind,
      insertText,
      documentation,
      range,
      additionalTextEdits,
      command: undefined,
    };
  },
};

export const completionListAdaptor: Adaptor<
  lsp.CompletionList | lsp.CompletionItem[],
  monaco.languages.CompletionList
> = {
  from: function (
    _m: monaco.languages.CompletionList,
  ): lsp.CompletionList | lsp.CompletionItem[] {
    throw new Error("Function not implemented.");
  },
  to: function (
    completions: lsp.CompletionList | lsp.CompletionItem[],
    range: monaco.IRange,
  ): monaco.languages.CompletionList {
    const items = Array.isArray(completions) ? completions : completions.items;
    return {
      suggestions: items.map((i) => completionItemAdaptor.to(i, range)),
    };
  },
};

export const hoverAdaptor: Adaptor<lsp.Hover, monaco.languages.Hover> = {
  from: function (_m: monaco.languages.Hover): lsp.Hover {
    throw new Error("Function not implemented.");
  },
  to: function (hover: lsp.Hover): monaco.languages.Hover {
    const range = hover.range ? rangeAdaptor.to(hover.range) : undefined;
    if (Array.isArray(hover.contents)) {
      return {
        range,
        contents: hover.contents.map(markedStringAdaptor.to),
      };
    } else if (lsp.MarkedString.is(hover.contents)) {
      return {
        range,
        contents: [markedStringAdaptor.to(hover.contents)],
      };
    } else {
      return {
        range,
        contents: [markupAdaptor.to(hover.contents)],
      };
    }
  },
};

export const formattingOptionsAdaptor: Adaptor<
  lsp.FormattingOptions,
  monaco.languages.FormattingOptions
> = {
  from: function (
    m: monaco.languages.FormattingOptions,
  ): lsp.FormattingOptions {
    return {
      insertSpaces: m.insertSpaces,
      tabSize: m.tabSize,
    };
  },
  to: function (_l: lsp.FormattingOptions): monaco.languages.FormattingOptions {
    throw new Error("Function not implemented.");
  },
};

export const textEditAdaptor: Adaptor<lsp.TextEdit, monaco.languages.TextEdit> =
  {
    from: function (_m: monaco.languages.TextEdit): lsp.TextEdit {
      throw new Error("Function not implemented.");
    },
    to: function (l: lsp.TextEdit): monaco.languages.TextEdit {
      return {
        range: rangeAdaptor.to(l.range),
        text: l.newText,
      };
    },
  };

const fromSignatureHelpTriggerKindMap = {
  [monaco.languages.SignatureHelpTriggerKind.Invoke]:
    lsp.SignatureHelpTriggerKind.Invoked,
  [monaco.languages.SignatureHelpTriggerKind.ContentChange]:
    lsp.SignatureHelpTriggerKind.ContentChange,
  [monaco.languages.SignatureHelpTriggerKind.TriggerCharacter]:
    lsp.SignatureHelpTriggerKind.TriggerCharacter,
};

const toSignatureHelpTriggerKindMap = {
  [lsp.SignatureHelpTriggerKind.Invoked]:
    monaco.languages.SignatureHelpTriggerKind.Invoke,
  [lsp.SignatureHelpTriggerKind.TriggerCharacter]:
    monaco.languages.SignatureHelpTriggerKind.TriggerCharacter,
  [lsp.SignatureHelpTriggerKind.ContentChange]:
    monaco.languages.SignatureHelpTriggerKind.ContentChange,
};

export const signatureHelpContextAdaptor: Adaptor<
  lsp.SignatureHelpContext,
  monaco.languages.SignatureHelpContext
> = {
  from: function (
    m: monaco.languages.SignatureHelpContext,
  ): lsp.SignatureHelpContext {
    return {
      isRetrigger: m.isRetrigger,
      triggerKind: fromSignatureHelpTriggerKindMap[m.triggerKind],
      triggerCharacter: m.triggerCharacter,
    };
  },
  to: function (
    l: lsp.SignatureHelpContext,
  ): monaco.languages.SignatureHelpContext {
    return {
      isRetrigger: l.isRetrigger,
      triggerKind: toSignatureHelpTriggerKindMap[l.triggerKind],
      activeSignatureHelp: l.activeSignatureHelp
        ? signatureHelpAdaptor.to(l.activeSignatureHelp)
        : undefined,
      triggerCharacter: l.triggerCharacter,
    };
  },
};

const ParameterInformationAdapter: Adaptor<
  lsp.ParameterInformation,
  monaco.languages.ParameterInformation
> = {
  from: function (
    m: monaco.languages.ParameterInformation,
  ): lsp.ParameterInformation {
    if (m.documentation) {
      if (typeof m.documentation === "string") {
        return {
          label: m.label,
          documentation: m.documentation,
        };
      } else {
        return {
          label: m.label,
          documentation: markupAdaptor.from(m.documentation),
        };
      }
    } else {
      return {
        label: m.label,
      };
    }
  },
  to: function (
    l: lsp.ParameterInformation,
  ): monaco.languages.ParameterInformation {
    if (l.documentation) {
      if (typeof l.documentation === "string") {
        return {
          label: l.label,
          documentation: l.documentation,
        };
      } else {
        return {
          label: l.label,
          documentation: markupAdaptor.to(l.documentation),
        };
      }
    } else {
      return {
        label: l.label,
      };
    }
  },
};

const SignatureInformationAdaptor: Adaptor<
  lsp.SignatureInformation,
  monaco.languages.SignatureInformation
> = {
  from: function (
    m: monaco.languages.SignatureInformation,
  ): lsp.SignatureInformation {
    const base = {
      label: m.label,
      activeParameter: m.activeParameter,
      parameters: m.parameters.map(ParameterInformationAdapter.from),
    };
    if (m.documentation) {
      if (typeof m.documentation === "string") {
        return {
          ...base,
          documentation: m.documentation,
        };
      } else {
        return {
          ...base,
          documentation: markupAdaptor.from(m.documentation),
        };
      }
    } else {
      return base;
    }
  },
  to: function (
    l: lsp.SignatureInformation,
  ): monaco.languages.SignatureInformation {
    return {
      label: l.label,
      parameters: l.parameters
        ? l.parameters.map(ParameterInformationAdapter.to)
        : [],
      activeParameter: l.activeParameter,
      documentation: l.documentation,
    };
  },
};

export const signatureHelpAdaptor: Adaptor<
  lsp.SignatureHelp,
  monaco.languages.SignatureHelp
> = {
  from: function (m: monaco.languages.SignatureHelp): lsp.SignatureHelp {
    return {
      signatures: m.signatures.map(SignatureInformationAdaptor.from),
      activeParameter: m.activeParameter,
      activeSignature: m.activeSignature,
    };
  },
  to: function (l: lsp.SignatureHelp): monaco.languages.SignatureHelp {
    return {
      activeParameter: l.activeParameter ?? 0,
      activeSignature: l.activeSignature ?? 0,
      signatures: l.signatures.map(SignatureInformationAdaptor.to),
    };
  },
};

export const locationAdaptor: Adaptor<lsp.Location, monaco.languages.Location> =
  {
    from: function (m: monaco.languages.Location): lsp.Location {
      return {
        range: rangeAdaptor.from(m.range),
        uri: m.uri.toString(),
      };
    },
    to: function (l: lsp.Location): monaco.languages.Location {
      return {
        range: rangeAdaptor.to(l.range),
        uri: monaco.Uri.parse(l.uri),
      };
    },
  };

export const definitionAdaptor: Adaptor<
  lsp.Definition,
  monaco.languages.Definition
> = {
  from: function (m: monaco.languages.Definition): lsp.Definition {
    if (Array.isArray(m)) {
      return m.map(locationAdaptor.from);
    } else {
      return locationAdaptor.from(m);
    }
  },
  to: function (l: lsp.Definition): monaco.languages.Definition {
    if (lsp.Location.is(l)) {
      return locationAdaptor.to(l);
    } else {
      return l.map(locationAdaptor.to);
    }
  },
};

export const prepareRenameResultAdaptor: Adaptor<
  lsp.PrepareRenameResult,
  monaco.languages.RenameLocation & monaco.languages.Rejection
> = {
  from: function (
    _m: monaco.languages.RenameLocation & monaco.languages.Rejection,
  ): lsp.PrepareRenameResult {
    throw new Error("Function not implemented.");
  },
  to: function (
    l: lsp.PrepareRenameResult,
    defaultRange: monaco.IRange,
    defaultWord: string,
  ): monaco.languages.RenameLocation & monaco.languages.Rejection {
    if (lsp.Range.is(l)) {
      const range = rangeAdaptor.to(l);
      return {
        range,
        text: defaultWord,
      };
    } else if ("range" in l) {
      return {
        range: rangeAdaptor.to(l.range),
        text: l.placeholder,
      };
    } else {
      return {
        range: defaultRange,
        text: defaultWord,
      };
    }
  },
};

export const workspaceEditAdaptor: Adaptor<
  lsp.WorkspaceEdit,
  monaco.languages.WorkspaceEdit
> = {
  from: function (_m: monaco.languages.WorkspaceEdit): lsp.WorkspaceEdit {
    throw new Error("Function not implemented.");
  },
  to: function (l: lsp.WorkspaceEdit): monaco.languages.WorkspaceEdit {
    const edits: monaco.languages.IWorkspaceTextEdit[] = [];
    if (l.changes) {
      for (const uri in l.changes) {
        for (const edit of l.changes[uri]) {
          const resource = monaco.Uri.parse(uri);
          const model = monaco.editor.getModel(resource);
          if (model === null) continue;
          edits.push({
            resource,
            textEdit: textEditAdaptor.to(edit),
            versionId: model.getVersionId(),
          });
        }
      }
      return { edits };
    } else {
      return { edits };
    }
  },
};

export const codeLensAdaptor: Adaptor<lsp.CodeLens, monaco.languages.CodeLens> =
  {
    from: function (): lsp.CodeLens {
      throw new Error("Function not implemented.");
    },
    to: function (l: lsp.CodeLens): monaco.languages.CodeLens {
      return {
        range: rangeAdaptor.to(l.range),
        command: l.command
          ? {
              id: l.command.command,
              title: l.command.title,
              arguments: l.command.arguments,
            }
          : undefined,
      };
    },
  };
