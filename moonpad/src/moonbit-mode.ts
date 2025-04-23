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
import * as oniguruma from "vscode-oniguruma";
import * as textmate from "vscode-textmate";
import * as adaptor from "./adaptor";
import * as connection from "./connection";
import * as mfs from "./mfs";
import * as moon from "./moon";
import moonbitTmGrammar from "./moonbit.tmLanguage.json?raw";

type initParams = {
  onigWasmUrl: string;
  lspWorker: Worker;
  mooncWorkerFactory: () => Worker;
  codeLensFilter?: (lens: lsp.CodeLens) => boolean;
};

function init(params: initParams): typeof moon {
  const fs = mfs.MFS.getMFs();
  const {
    onigWasmUrl,
    lspWorker,
    mooncWorkerFactory,
    codeLensFilter = () => true,
  } = params;
  let moonbitTokensProvider: monaco.languages.TokensProvider | null = null;

  const factory: monaco.languages.TokensProviderFactory = {
    async create() {
      if (moonbitTokensProvider !== null) return moonbitTokensProvider;
      const response = await fetch(onigWasmUrl);
      await oniguruma.loadWASM(response);
      const registry = new textmate.Registry({
        onigLib: Promise.resolve({
          createOnigScanner: oniguruma.createOnigScanner,
          createOnigString: oniguruma.createOnigString,
        }),
        loadGrammar: async (scopeName) => {
          if (scopeName === "source.moonbit") {
            return textmate.parseRawGrammar(
              moonbitTmGrammar,
              "moonbit.tmLanguage.json",
            );
          }
        },
      });

      const grammar = await registry.loadGrammar("source.moonbit");
      if (grammar === null) return null;
      moonbitTokensProvider = {
        getInitialState(): monaco.languages.IState {
          return textmate.INITIAL;
        },
        tokenize(
          line: string,
          state: monaco.languages.IState,
        ): monaco.languages.ILineTokens {
          const tokenizeLineResult = grammar.tokenizeLine(
            line,
            state as textmate.StateStack,
          );
          const { tokens, ruleStack: endState } = tokenizeLineResult;
          return {
            tokens: tokens.map((tok) => ({
              scopes: tok.scopes[tok.scopes.length - 1],
              startIndex: tok.startIndex,
            })),
            endState,
          };
        },
      };
      return moonbitTokensProvider;
    },
  };

  monaco.editor.defineTheme("light-plus", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "meta.embedded", foreground: "000000ff" },
      { token: "source.groovy.embedded", foreground: "000000ff" },
      {
        token: "string meta.image.inline.markdown",
        foreground: "000000ff",
      },
      { token: "variable.legacy.builtin.python", foreground: "000000ff" },
      { token: "emphasis", fontStyle: "italic" },
      { token: "strong", fontStyle: "bold" },
      { token: "meta.diff.header", foreground: "000080" },
      { token: "comment", foreground: "008000" },
      { token: "constant.language", foreground: "0000ff" },
      { token: "constant.numeric", foreground: "098658" },
      { token: "variable.other.enummember", foreground: "098658" },
      { token: "keyword.operator.plus.exponent", foreground: "098658" },
      { token: "keyword.operator.minus.exponent", foreground: "098658" },
      { token: "constant.regexp", foreground: "811f3f" },
      { token: "entity.name.tag", foreground: "800000" },
      { token: "entity.name.selector", foreground: "800000" },
      { token: "entity.other.attribute-name", foreground: "e50000" },
      {
        token: "entity.other.attribute-name.class.css",
        foreground: "800000",
      },
      {
        token: "source.css entity.other.attribute-name.class",
        foreground: "800000",
      },
      { token: "entity.other.attribute-name.id.css", foreground: "800000" },
      {
        token: "entity.other.attribute-name.parent-selector.css",
        foreground: "800000",
      },
      {
        token: "entity.other.attribute-name.parent.less",
        foreground: "800000",
      },
      {
        token: "source.css entity.other.attribute-name.pseudo-class",
        foreground: "800000",
      },
      {
        token: "entity.other.attribute-name.pseudo-element.css",
        foreground: "800000",
      },
      {
        token: "source.css.less entity.other.attribute-name.id",
        foreground: "800000",
      },
      { token: "entity.other.attribute-name.scss", foreground: "800000" },
      { token: "invalid", foreground: "cd3131" },
      { token: "markup.underline", fontStyle: "underline" },
      { token: "markup.bold", foreground: "000080", fontStyle: "bold" },
      { token: "markup.heading", foreground: "800000", fontStyle: "bold" },
      { token: "markup.italic", fontStyle: "italic" },
      { token: "markup.strikethrough", fontStyle: "strikethrough" },
      { token: "markup.inserted", foreground: "098658" },
      { token: "markup.deleted", foreground: "a31515" },
      { token: "markup.changed", foreground: "0451a5" },
      {
        token: "punctuation.definition.quote.begin.markdown",
        foreground: "0451a5",
      },
      {
        token: "punctuation.definition.list.begin.markdown",
        foreground: "0451a5",
      },
      { token: "markup.inline.raw", foreground: "800000" },
      { token: "punctuation.definition.tag", foreground: "800000" },
      { token: "meta.preprocessor", foreground: "0000ff" },
      { token: "entity.name.function.preprocessor", foreground: "0000ff" },
      { token: "meta.preprocessor.string", foreground: "a31515" },
      { token: "meta.preprocessor.numeric", foreground: "098658" },
      {
        token: "meta.structure.dictionary.key.python",
        foreground: "0451a5",
      },
      { token: "storage", foreground: "0000ff" },
      { token: "storage.type", foreground: "0000ff" },
      { token: "storage.modifier", foreground: "0000ff" },
      { token: "keyword.operator.noexcept", foreground: "0000ff" },
      { token: "string", foreground: "a31515" },
      { token: "meta.embedded.assembly", foreground: "a31515" },
      { token: "string.comment.buffered.block.pug", foreground: "0000ff" },
      { token: "string.quoted.pug", foreground: "0000ff" },
      { token: "string.interpolated.pug", foreground: "0000ff" },
      { token: "string.unquoted.plain.in.yaml", foreground: "0000ff" },
      { token: "string.unquoted.plain.out.yaml", foreground: "0000ff" },
      { token: "string.unquoted.block.yaml", foreground: "0000ff" },
      { token: "string.quoted.single.yaml", foreground: "0000ff" },
      { token: "string.quoted.double.xml", foreground: "0000ff" },
      { token: "string.quoted.single.xml", foreground: "0000ff" },
      { token: "string.unquoted.cdata.xml", foreground: "0000ff" },
      { token: "string.quoted.double.html", foreground: "0000ff" },
      { token: "string.quoted.single.html", foreground: "0000ff" },
      { token: "string.unquoted.html", foreground: "0000ff" },
      { token: "string.quoted.single.handlebars", foreground: "0000ff" },
      { token: "string.quoted.double.handlebars", foreground: "0000ff" },
      { token: "string.regexp", foreground: "811f3f" },
      {
        token: "punctuation.definition.template-expression.begin",
        foreground: "0000ff",
      },
      {
        token: "punctuation.definition.template-expression.end",
        foreground: "0000ff",
      },
      { token: "punctuation.section.embedded", foreground: "0000ff" },
      { token: "meta.template.expression", foreground: "000000" },
      { token: "support.constant.property-value", foreground: "0451a5" },
      { token: "support.constant.font-name", foreground: "0451a5" },
      { token: "support.constant.media-type", foreground: "0451a5" },
      { token: "support.constant.media", foreground: "0451a5" },
      { token: "constant.other.color.rgb-value", foreground: "0451a5" },
      { token: "constant.other.rgb-value", foreground: "0451a5" },
      { token: "support.constant.color", foreground: "0451a5" },
      {
        token: "support.type.vendored.property-name",
        foreground: "e50000",
      },
      { token: "support.type.property-name", foreground: "e50000" },
      { token: "source.css variable", foreground: "e50000" },
      { token: "source.coffee.embedded", foreground: "e50000" },
      { token: "support.type.property-name.json", foreground: "0451a5" },
      { token: "keyword", foreground: "0000ff" },
      { token: "keyword.control", foreground: "0000ff" },
      { token: "keyword.operator", foreground: "000000" },
      { token: "keyword.operator.new", foreground: "0000ff" },
      { token: "keyword.operator.expression", foreground: "0000ff" },
      { token: "keyword.operator.cast", foreground: "0000ff" },
      { token: "keyword.operator.sizeof", foreground: "0000ff" },
      { token: "keyword.operator.alignof", foreground: "0000ff" },
      { token: "keyword.operator.typeid", foreground: "0000ff" },
      { token: "keyword.operator.alignas", foreground: "0000ff" },
      { token: "keyword.operator.instanceof", foreground: "0000ff" },
      { token: "keyword.operator.logical.python", foreground: "0000ff" },
      { token: "keyword.operator.wordlike", foreground: "0000ff" },
      { token: "keyword.other.unit", foreground: "098658" },
      {
        token: "punctuation.section.embedded.begin.php",
        foreground: "800000",
      },
      {
        token: "punctuation.section.embedded.end.php",
        foreground: "800000",
      },
      { token: "support.function.git-rebase", foreground: "0451a5" },
      { token: "constant.sha.git-rebase", foreground: "098658" },
      { token: "storage.modifier.import.java", foreground: "000000" },
      { token: "variable.language.wildcard.java", foreground: "000000" },
      { token: "storage.modifier.package.java", foreground: "000000" },
      { token: "variable.language", foreground: "0000ff" },
      { token: "entity.name.function", foreground: "795E26" },
      { token: "support.function", foreground: "795E26" },
      { token: "support.constant.handlebars", foreground: "795E26" },
      {
        token: "source.powershell variable.other.member",
        foreground: "795E26",
      },
      {
        token: "entity.name.operator.custom-literal",
        foreground: "795E26",
      },
      { token: "support.class", foreground: "267f99" },
      { token: "support.type", foreground: "267f99" },
      { token: "entity.name.type", foreground: "267f99" },
      { token: "entity.name.namespace", foreground: "267f99" },
      { token: "entity.other.attribute", foreground: "267f99" },
      { token: "entity.name.scope-resolution", foreground: "267f99" },
      { token: "entity.name.class", foreground: "267f99" },
      { token: "storage.type.numeric.go", foreground: "267f99" },
      { token: "storage.type.byte.go", foreground: "267f99" },
      { token: "storage.type.boolean.go", foreground: "267f99" },
      { token: "storage.type.string.go", foreground: "267f99" },
      { token: "storage.type.uintptr.go", foreground: "267f99" },
      { token: "storage.type.error.go", foreground: "267f99" },
      { token: "storage.type.rune.go", foreground: "267f99" },
      { token: "storage.type.cs", foreground: "267f99" },
      { token: "storage.type.generic.cs", foreground: "267f99" },
      { token: "storage.type.modifier.cs", foreground: "267f99" },
      { token: "storage.type.variable.cs", foreground: "267f99" },
      { token: "storage.type.annotation.java", foreground: "267f99" },
      { token: "storage.type.generic.java", foreground: "267f99" },
      { token: "storage.type.java", foreground: "267f99" },
      { token: "storage.type.object.array.java", foreground: "267f99" },
      { token: "storage.type.primitive.array.java", foreground: "267f99" },
      { token: "storage.type.primitive.java", foreground: "267f99" },
      { token: "storage.type.token.java", foreground: "267f99" },
      { token: "storage.type.groovy", foreground: "267f99" },
      { token: "storage.type.annotation.groovy", foreground: "267f99" },
      { token: "storage.type.parameters.groovy", foreground: "267f99" },
      { token: "storage.type.generic.groovy", foreground: "267f99" },
      { token: "storage.type.object.array.groovy", foreground: "267f99" },
      {
        token: "storage.type.primitive.array.groovy",
        foreground: "267f99",
      },
      { token: "storage.type.primitive.groovy", foreground: "267f99" },
      { token: "meta.type.cast.expr", foreground: "267f99" },
      { token: "meta.type.new.expr", foreground: "267f99" },
      { token: "support.constant.math", foreground: "267f99" },
      { token: "support.constant.dom", foreground: "267f99" },
      { token: "support.constant.json", foreground: "267f99" },
      { token: "entity.other.inherited-class", foreground: "267f99" },
      { token: "keyword.control", foreground: "AF00DB" },
      { token: "source.cpp keyword.operator.new", foreground: "AF00DB" },
      { token: "source.cpp keyword.operator.delete", foreground: "AF00DB" },
      { token: "keyword.other.using", foreground: "AF00DB" },
      { token: "keyword.other.directive.using", foreground: "AF00DB" },
      { token: "keyword.other.operator", foreground: "AF00DB" },
      { token: "entity.name.operator", foreground: "AF00DB" },
      { token: "variable", foreground: "001080" },
      { token: "meta.definition.variable.name", foreground: "001080" },
      { token: "support.variable", foreground: "001080" },
      { token: "entity.name.variable", foreground: "001080" },
      { token: "constant.other.placeholder", foreground: "001080" },
      { token: "variable.other.constant", foreground: "0070C1" },
      { token: "variable.other.enummember", foreground: "0070C1" },
      { token: "meta.object-literal.key", foreground: "001080" },
      { token: "support.constant.property-value", foreground: "0451a5" },
      { token: "support.constant.font-name", foreground: "0451a5" },
      { token: "support.constant.media-type", foreground: "0451a5" },
      { token: "support.constant.media", foreground: "0451a5" },
      { token: "constant.other.color.rgb-value", foreground: "0451a5" },
      { token: "constant.other.rgb-value", foreground: "0451a5" },
      { token: "support.constant.color", foreground: "0451a5" },
      {
        token: "punctuation.definition.group.regexp",
        foreground: "d16969",
      },
      {
        token: "punctuation.definition.group.assertion.regexp",
        foreground: "d16969",
      },
      {
        token: "punctuation.definition.character-class.regexp",
        foreground: "d16969",
      },
      {
        token: "punctuation.character.set.begin.regexp",
        foreground: "d16969",
      },
      {
        token: "punctuation.character.set.end.regexp",
        foreground: "d16969",
      },
      { token: "keyword.operator.negation.regexp", foreground: "d16969" },
      { token: "support.other.parenthesis.regexp", foreground: "d16969" },
      {
        token: "constant.character.character-class.regexp",
        foreground: "811f3f",
      },
      {
        token: "constant.other.character-class.set.regexp",
        foreground: "811f3f",
      },
      {
        token: "constant.other.character-class.regexp",
        foreground: "811f3f",
      },
      { token: "constant.character.set.regexp", foreground: "811f3f" },
      { token: "keyword.operator.quantifier.regexp", foreground: "000000" },
      { token: "keyword.operator.or.regexp", foreground: "EE0000" },
      { token: "keyword.control.anchor.regexp", foreground: "EE0000" },
      { token: "constant.character", foreground: "0000ff" },
      { token: "constant.other.option", foreground: "0000ff" },
      { token: "constant.character.escape", foreground: "EE0000" },
      { token: "entity.name.label", foreground: "000000" },
    ],
    colors: {},
  });

  monaco.editor.defineTheme("dark-plus", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "meta.embedded", foreground: "D4D4D4" },
      { token: "source.groovy.embedded", foreground: "D4D4D4" },
      { token: "string meta.image.inline.markdown", foreground: "D4D4D4" },
      { token: "variable.legacy.builtin.python", foreground: "D4D4D4" },
      { token: "emphasis", fontStyle: "italic" },
      { token: "strong", fontStyle: "bold" },
      { token: "header", foreground: "000080" },
      { token: "comment", foreground: "6A9955" },
      { token: "constant.language", foreground: "569cd6" },
      { token: "constant.numeric", foreground: "b5cea8" },
      { token: "variable.other.enummember", foreground: "b5cea8" },
      { token: "keyword.operator.plus.exponent", foreground: "b5cea8" },
      { token: "keyword.operator.minus.exponent", foreground: "b5cea8" },
      { token: "constant.regexp", foreground: "646695" },
      { token: "entity.name.tag", foreground: "569cd6" },
      { token: "entity.name.tag.css", foreground: "d7ba7d" },
      { token: "entity.name.tag.less", foreground: "d7ba7d" },
      { token: "entity.other.attribute-name", foreground: "9cdcfe" },
      {
        token: "entity.other.attribute-name.class.css",
        foreground: "d7ba7d",
      },
      {
        token: "source.css entity.other.attribute-name.class",
        foreground: "d7ba7d",
      },
      { token: "entity.other.attribute-name.id.css", foreground: "d7ba7d" },
      {
        token: "entity.other.attribute-name.parent-selector.css",
        foreground: "d7ba7d",
      },
      {
        token: "entity.other.attribute-name.parent.less",
        foreground: "d7ba7d",
      },
      {
        token: "source.css entity.other.attribute-name.pseudo-class",
        foreground: "d7ba7d",
      },
      {
        token: "entity.other.attribute-name.pseudo-element.css",
        foreground: "d7ba7d",
      },
      {
        token: "source.css.less entity.other.attribute-name.id",
        foreground: "d7ba7d",
      },
      { token: "entity.other.attribute-name.scss", foreground: "d7ba7d" },
      { token: "invalid", foreground: "f44747" },
      { token: "markup.underline", fontStyle: "underline" },
      { token: "markup.bold", foreground: "569cd6", fontStyle: "bold" },
      { token: "markup.heading", foreground: "569cd6", fontStyle: "bold" },
      { token: "markup.italic", fontStyle: "italic" },
      { token: "markup.strikethrough", fontStyle: "strikethrough" },
      { token: "markup.inserted", foreground: "b5cea8" },
      { token: "markup.deleted", foreground: "ce9178" },
      { token: "markup.changed", foreground: "569cd6" },
      {
        token: "punctuation.definition.quote.begin.markdown",
        foreground: "6A9955",
      },
      {
        token: "punctuation.definition.list.begin.markdown",
        foreground: "6796e6",
      },
      { token: "markup.inline.raw", foreground: "ce9178" },
      { token: "punctuation.definition.tag", foreground: "808080" },
      { token: "meta.preprocessor", foreground: "569cd6" },
      { token: "entity.name.function.preprocessor", foreground: "569cd6" },
      { token: "meta.preprocessor.string", foreground: "ce9178" },
      { token: "meta.preprocessor.numeric", foreground: "b5cea8" },
      {
        token: "meta.structure.dictionary.key.python",
        foreground: "9cdcfe",
      },
      { token: "meta.diff.header", foreground: "569cd6" },
      { token: "storage", foreground: "569cd6" },
      { token: "storage.type", foreground: "569cd6" },
      { token: "storage.modifier", foreground: "569cd6" },
      { token: "keyword.operator.noexcept", foreground: "569cd6" },
      { token: "string", foreground: "ce9178" },
      { token: "meta.embedded.assembly", foreground: "ce9178" },
      { token: "string.tag", foreground: "ce9178" },
      { token: "string.value", foreground: "ce9178" },
      { token: "string.regexp", foreground: "d16969" },
      {
        token: "punctuation.definition.template-expression.begin",
        foreground: "569cd6",
      },
      {
        token: "punctuation.definition.template-expression.end",
        foreground: "569cd6",
      },
      { token: "punctuation.section.embedded", foreground: "569cd6" },
      { token: "meta.template.expression", foreground: "d4d4d4" },
      {
        token: "support.type.vendored.property-name",
        foreground: "9cdcfe",
      },
      { token: "support.type.property-name", foreground: "9cdcfe" },
      { token: "source.css variable", foreground: "9cdcfe" },
      { token: "source.coffee.embedded", foreground: "9cdcfe" },
      { token: "keyword", foreground: "569cd6" },
      { token: "keyword.control", foreground: "569cd6" },
      { token: "keyword.operator", foreground: "d4d4d4" },
      { token: "keyword.operator.new", foreground: "569cd6" },
      { token: "keyword.operator.expression", foreground: "569cd6" },
      { token: "keyword.operator.cast", foreground: "569cd6" },
      { token: "keyword.operator.sizeof", foreground: "569cd6" },
      { token: "keyword.operator.alignof", foreground: "569cd6" },
      { token: "keyword.operator.typeid", foreground: "569cd6" },
      { token: "keyword.operator.alignas", foreground: "569cd6" },
      { token: "keyword.operator.instanceof", foreground: "569cd6" },
      { token: "keyword.operator.logical.python", foreground: "569cd6" },
      { token: "keyword.operator.wordlike", foreground: "569cd6" },
      { token: "keyword.other.unit", foreground: "b5cea8" },
      {
        token: "punctuation.section.embedded.begin.php",
        foreground: "569cd6",
      },
      {
        token: "punctuation.section.embedded.end.php",
        foreground: "569cd6",
      },
      { token: "support.function.git-rebase", foreground: "9cdcfe" },
      { token: "constant.sha.git-rebase", foreground: "b5cea8" },
      { token: "storage.modifier.import.java", foreground: "d4d4d4" },
      { token: "variable.language.wildcard.java", foreground: "d4d4d4" },
      { token: "storage.modifier.package.java", foreground: "d4d4d4" },
      { token: "variable.language", foreground: "569cd6" },
      { token: "entity.name.function", foreground: "DCDCAA" },
      { token: "support.function", foreground: "DCDCAA" },
      { token: "support.constant.handlebars", foreground: "DCDCAA" },
      {
        token: "source.powershell variable.other.member",
        foreground: "DCDCAA",
      },
      {
        token: "entity.name.operator.custom-literal",
        foreground: "DCDCAA",
      },
      { token: "support.class", foreground: "4EC9B0" },
      { token: "support.type", foreground: "4EC9B0" },
      { token: "entity.name.type", foreground: "4EC9B0" },
      { token: "entity.name.namespace", foreground: "4EC9B0" },
      { token: "entity.other.attribute", foreground: "4EC9B0" },
      { token: "entity.name.scope-resolution", foreground: "4EC9B0" },
      { token: "entity.name.class", foreground: "4EC9B0" },
      { token: "storage.type.numeric.go", foreground: "4EC9B0" },
      { token: "storage.type.byte.go", foreground: "4EC9B0" },
      { token: "storage.type.boolean.go", foreground: "4EC9B0" },
      { token: "storage.type.string.go", foreground: "4EC9B0" },
      { token: "storage.type.uintptr.go", foreground: "4EC9B0" },
      { token: "storage.type.error.go", foreground: "4EC9B0" },
      { token: "storage.type.rune.go", foreground: "4EC9B0" },
      { token: "storage.type.cs", foreground: "4EC9B0" },
      { token: "storage.type.generic.cs", foreground: "4EC9B0" },
      { token: "storage.type.modifier.cs", foreground: "4EC9B0" },
      { token: "storage.type.variable.cs", foreground: "4EC9B0" },
      { token: "storage.type.annotation.java", foreground: "4EC9B0" },
      { token: "storage.type.generic.java", foreground: "4EC9B0" },
      { token: "storage.type.java", foreground: "4EC9B0" },
      { token: "storage.type.object.array.java", foreground: "4EC9B0" },
      { token: "storage.type.primitive.array.java", foreground: "4EC9B0" },
      { token: "storage.type.primitive.java", foreground: "4EC9B0" },
      { token: "storage.type.token.java", foreground: "4EC9B0" },
      { token: "storage.type.groovy", foreground: "4EC9B0" },
      { token: "storage.type.annotation.groovy", foreground: "4EC9B0" },
      { token: "storage.type.parameters.groovy", foreground: "4EC9B0" },
      { token: "storage.type.generic.groovy", foreground: "4EC9B0" },
      { token: "storage.type.object.array.groovy", foreground: "4EC9B0" },
      {
        token: "storage.type.primitive.array.groovy",
        foreground: "4EC9B0",
      },
      { token: "storage.type.primitive.groovy", foreground: "4EC9B0" },
      { token: "meta.type.cast.expr", foreground: "4EC9B0" },
      { token: "meta.type.new.expr", foreground: "4EC9B0" },
      { token: "support.constant.math", foreground: "4EC9B0" },
      { token: "support.constant.dom", foreground: "4EC9B0" },
      { token: "support.constant.json", foreground: "4EC9B0" },
      { token: "entity.other.inherited-class", foreground: "4EC9B0" },
      { token: "keyword.control", foreground: "C586C0" },
      { token: "source.cpp keyword.operator.new", foreground: "C586C0" },
      { token: "keyword.operator.delete", foreground: "C586C0" },
      { token: "keyword.other.using", foreground: "C586C0" },
      { token: "keyword.other.directive.using", foreground: "C586C0" },
      { token: "keyword.other.operator", foreground: "C586C0" },
      { token: "entity.name.operator", foreground: "C586C0" },
      { token: "variable", foreground: "9CDCFE" },
      { token: "meta.definition.variable.name", foreground: "9CDCFE" },
      { token: "support.variable", foreground: "9CDCFE" },
      { token: "entity.name.variable", foreground: "9CDCFE" },
      { token: "constant.other.placeholder", foreground: "9CDCFE" },
      { token: "variable.other.constant", foreground: "4FC1FF" },
      { token: "variable.other.enummember", foreground: "4FC1FF" },
      { token: "meta.object-literal.key", foreground: "9CDCFE" },
      { token: "support.constant.property-value", foreground: "CE9178" },
      { token: "support.constant.font-name", foreground: "CE9178" },
      { token: "support.constant.media-type", foreground: "CE9178" },
      { token: "support.constant.media", foreground: "CE9178" },
      { token: "constant.other.color.rgb-value", foreground: "CE9178" },
      { token: "constant.other.rgb-value", foreground: "CE9178" },
      { token: "support.constant.color", foreground: "CE9178" },
      {
        token: "punctuation.definition.group.regexp",
        foreground: "CE9178",
      },
      {
        token: "punctuation.definition.group.assertion.regexp",
        foreground: "CE9178",
      },
      {
        token: "punctuation.definition.character-class.regexp",
        foreground: "CE9178",
      },
      {
        token: "punctuation.character.set.begin.regexp",
        foreground: "CE9178",
      },
      {
        token: "punctuation.character.set.end.regexp",
        foreground: "CE9178",
      },
      { token: "keyword.operator.negation.regexp", foreground: "CE9178" },
      { token: "support.other.parenthesis.regexp", foreground: "CE9178" },
      {
        token: "constant.character.character-class.regexp",
        foreground: "d16969",
      },
      {
        token: "constant.other.character-class.set.regexp",
        foreground: "d16969",
      },
      {
        token: "constant.other.character-class.regexp",
        foreground: "d16969",
      },
      { token: "constant.character.set.regexp", foreground: "d16969" },
      { token: "keyword.operator.or.regexp", foreground: "DCDCAA" },
      { token: "keyword.control.anchor.regexp", foreground: "DCDCAA" },
      { token: "keyword.operator.quantifier.regexp", foreground: "d7ba7d" },
      { token: "constant.character", foreground: "569cd6" },
      { token: "constant.other.option", foreground: "569cd6" },
      { token: "constant.character.escape", foreground: "d7ba7d" },
      { token: "entity.name.label", foreground: "C8C8C8" },
    ],
    colors: {},
  });

  monaco.languages.register({ id: "moonbit" });
  monaco.languages.registerTokensProviderFactory("moonbit", factory);
  monaco.languages.setLanguageConfiguration("moonbit", {
    comments: {
      lineComment: "//",
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: 'b"', close: '"' },
      { open: "b'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    onEnterRules: [
      {
        beforeText: /^\s*#\|.*/,
        action: {
          indentAction: monaco.languages.IndentAction.None,
          appendText: "#|",
        },
      },
      {
        beforeText: /^\s*\$\|.*/,
        action: {
          indentAction: monaco.languages.IndentAction.None,
          appendText: "$|",
        },
      },
      {
        beforeText: /^\/\/\//,
        action: {
          indentAction: monaco.languages.IndentAction.None,
          appendText: "/// ",
        },
      },
    ],
  });

  monaco.languages.onLanguage("moonbit", async () => {
    await connection.init(lspWorker);
    const c = await connection.connection;
    c.onNotification(lsp.PublishDiagnosticsNotification.type, (params) => {
      const { uri, diagnostics } = params;
      const model = monaco.editor.getModel(monaco.Uri.parse(uri));
      if (!model) return;
      monaco.editor.setModelMarkers(
        model,
        "moonbit",
        diagnostics.map(adaptor.diagnosticAdaptor.to),
      );
    });
  });

  monaco.editor.onDidCreateModel(async (model) => {
    if (model.uri.scheme === "moonbit-core") return;
    fs.writeFileSync(model.uri.path, model.getValue(), {
      encoding: "utf8",
    });
    const c = await connection.connection;
    model.onDidChangeContent(async (e) => {
      fs.writeFileSync(model.uri.path, model.getValue(), {
        encoding: "utf8",
      });
      c.sendNotification(lsp.DidChangeTextDocumentNotification.type, {
        textDocument: {
          uri: model.uri.toString(),
          version: model.getVersionId(),
        },
        contentChanges: e.changes.map(adaptor.contentChangeAdaptor.from),
      });
    });
    await c.sendNotification(lsp.DidOpenTextDocumentNotification.type, {
      textDocument: {
        languageId: model.getLanguageId(),
        text: model.getValue(),
        uri: model.uri.toString(),
        version: model.getVersionId(),
      },
    });
  });

  const completionProvider: monaco.languages.CompletionItemProvider = {
    triggerCharacters: [".", "@", ":", ">", "~"],
    async provideCompletionItems(model, position, context) {
      const c = await connection.connection;
      const wordInfo = model.getWordUntilPosition(position);
      const wordRange = new monaco.Range(
        position.lineNumber,
        wordInfo.startColumn,
        position.lineNumber,
        wordInfo.endColumn,
      );
      const res = await c.sendRequest(lsp.CompletionRequest.type, {
        position: adaptor.positionAdaptor.from(position),
        textDocument: { uri: model.uri.toString() },
        context: adaptor.completionContextAdaptor.from(context),
      } satisfies lsp.CompletionParams);
      if (res === null) return null;
      return adaptor.completionListAdaptor.to(res, wordRange);
    },
  };

  monaco.languages.registerCompletionItemProvider(
    { language: "moonbit" },
    completionProvider,
  );

  const hoverProvider: monaco.languages.HoverProvider = {
    async provideHover(model, position, _token, _context) {
      const c = await connection.connection;
      const res = await c.sendRequest(lsp.HoverRequest.type, {
        position: adaptor.positionAdaptor.from(position),
        textDocument: { uri: model.uri.toString() },
      } satisfies lsp.HoverParams);
      if (res === null) return null;
      return adaptor.hoverAdaptor.to(res);
    },
  };

  monaco.languages.registerHoverProvider(
    { language: "moonbit" },
    hoverProvider,
  );

  const documentFormattingEditProvider: monaco.languages.DocumentFormattingEditProvider =
    {
      async provideDocumentFormattingEdits(model, options, _token) {
        const c = await connection.connection;
        const res = await c.sendRequest(lsp.DocumentFormattingRequest.type, {
          textDocument: { uri: model.uri.toString() },
          options: adaptor.formattingOptionsAdaptor.from(options),
        } satisfies lsp.DocumentFormattingParams);
        if (res === null) return null;
        return res.map(adaptor.textEditAdaptor.to);
      },
    };

  monaco.languages.registerDocumentFormattingEditProvider(
    { language: "moonbit" },
    documentFormattingEditProvider,
  );

  const signatureHelpProvider: monaco.languages.SignatureHelpProvider = {
    signatureHelpTriggerCharacters: ["(", ","],
    async provideSignatureHelp(model, position, _token, context) {
      const c = await connection.connection;
      const res = await c.sendRequest(lsp.SignatureHelpRequest.type, {
        position: adaptor.positionAdaptor.from(position),
        textDocument: { uri: model.uri.toString() },
        context: adaptor.signatureHelpContextAdaptor.from(context),
      } satisfies lsp.SignatureHelpParams);
      if (res === null) return null;
      return {
        value: adaptor.signatureHelpAdaptor.to(res),
        dispose() {},
      };
    },
  };
  monaco.languages.registerSignatureHelpProvider(
    { language: "moonbit" },
    signatureHelpProvider,
  );

  const definitionProvider: monaco.languages.DefinitionProvider = {
    async provideDefinition(model, position, _token) {
      const c = await connection.connection;
      const res = await c.sendRequest(lsp.DefinitionRequest.type, {
        position: adaptor.positionAdaptor.from(position),
        textDocument: { uri: model.uri.toString() },
      } satisfies lsp.DefinitionParams);
      if (res === null) return null;
      if (Array.isArray(res) && lsp.LocationLink.is(res[0])) {
        console.error("LocationLink not supported yet");
        return null;
      } else {
        return adaptor.definitionAdaptor.to(res as lsp.Definition);
      }
    },
  };
  monaco.languages.registerDefinitionProvider(
    { language: "moonbit" },
    definitionProvider,
  );

  const renameProvider: monaco.languages.RenameProvider = {
    async resolveRenameLocation(model, position, _token) {
      const c = await connection.connection;
      const defaultWord = model.getWordAtPosition(position);
      if (defaultWord === null) return null;
      const defaultRange = new monaco.Range(
        position.lineNumber,
        defaultWord.startColumn,
        position.lineNumber,
        defaultWord.endColumn,
      );
      const defaultText = defaultWord.word;
      const res = await c.sendRequest(lsp.PrepareRenameRequest.type, {
        textDocument: { uri: model.uri.toString() },
        position: adaptor.positionAdaptor.from(position),
      } satisfies lsp.PrepareRenameParams);
      if (res === null) return null;
      return adaptor.prepareRenameResultAdaptor.to(
        res,
        defaultRange,
        defaultText,
      );
    },
    async provideRenameEdits(model, position, newName, _token) {
      const c = await connection.connection;
      const res = await c.sendRequest(lsp.RenameRequest.type, {
        textDocument: { uri: model.uri.toString() },
        position: adaptor.positionAdaptor.from(position),
        newName,
      } satisfies lsp.RenameParams);
      if (res === null) return null;
      return adaptor.workspaceEditAdaptor.to(res);
    },
  };

  monaco.languages.registerRenameProvider(
    { language: "moonbit" },
    renameProvider,
  );

  const referenceProvider: monaco.languages.ReferenceProvider = {
    async provideReferences(model, position, context, _token) {
      const c = await connection.connection;
      const res = await c.sendRequest(lsp.ReferencesRequest.type, {
        position: adaptor.positionAdaptor.from(position),
        textDocument: { uri: model.uri.toString() },
        context,
      } satisfies lsp.ReferenceParams);
      if (res === null) return null;
      return res
        .filter((l) => !l.uri.startsWith("moonbit-core"))
        .map(adaptor.locationAdaptor.to);
    },
  };

  monaco.languages.registerReferenceProvider(
    { language: "moonbit" },
    referenceProvider,
  );
  const codeLensProvider: monaco.languages.CodeLensProvider = {
    async provideCodeLenses(model, _token) {
      const c = await connection.connection;
      const res = await c.sendRequest(lsp.CodeLensRequest.type, {
        textDocument: { uri: model.uri.toString() },
      } satisfies lsp.CodeLensParams);
      if (res === null) return null;
      const lenses = res
        .filter((l) => !l.command?.command.startsWith("moonbit-ai"))
        .filter(codeLensFilter)
        .map(adaptor.codeLensAdaptor.to);
      return {
        dispose() {},
        lenses,
      };
    },
  };
  monaco.languages.registerCodeLensProvider(
    { language: "moonbit" },
    codeLensProvider,
  );
  moon.init(mooncWorkerFactory);
  monaco.editor.registerCommand("moonbit-lsp/trace-main", async (_, param) => {
    traceCommandFactory()(param.fileUri);
  });
  return moon;
}

function traceCommandFactory() {
  const decorations = new Map<string, string[]>();
  return async (uri: string): Promise<string | undefined> => {
    const muri = monaco.Uri.parse(uri);
    const model = monaco.editor.getModel(muri);
    if (model === null) return;
    const name = muri.path.split("/").at(-1)!;
    const result = await moon.compile({
      libInputs: [[name, model.getValue()]],
      enableValueTracing: true,
    });
    switch (result.kind) {
      case "error": {
        console.error(result.diagnostics);
        return;
      }
      case "success": {
        const js = result.js;
        const stdoutStream = moon.run(js);
        const lines = await collect(stdoutStream);
        const { traceResults, stdout } = parseTraceOutput(lines);
        const oldDecorations = decorations.get(model.id) ?? [];
        const newDecorations = renderTraceResults(
          model,
          oldDecorations,
          traceResults,
        );
        decorations.set(model.id, newDecorations);
        let d = model.onDidChangeContent(() => {
          decorations.set(model.id, model.deltaDecorations(newDecorations, []));
          d.dispose();
        });
        return stdout;
      }
    }
  };
}

type TraceResult = {
  name: string;
  value: string;
  line: number;
  start_column: number;
  end_column: number;
  hit: number;
};

const TRACING_START = "######MOONBIT_VALUE_TRACING_START######";

const TRACING_END = "######MOONBIT_VALUE_TRACING_END######";

async function collect(s: ReadableStream<string>): Promise<string[]> {
  const lines: string[] = [];
  await s.pipeTo(
    new WritableStream({
      write(chunk) {
        lines.push(chunk);
      },
    }),
  );
  return lines;
}

function traceKey(trace: TraceResult): string {
  return JSON.stringify({
    name: trace.name,
    line: trace.line,
    start_column: trace.start_column,
    end_column: trace.end_column,
  });
}

function parseTraceOutput(lines: string[]): {
  traceResults: TraceResult[];
  stdout: string;
} {
  const results = new Map<string, TraceResult>();
  const stdoutLines: string[] = [];
  let isInTrace = false;
  for (const line of lines) {
    if (line === TRACING_START) {
      isInTrace = true;
      continue;
    } else if (line === TRACING_END) {
      isInTrace = false;
      continue;
    }
    if (isInTrace) {
      const j = JSON.parse(line);
      j.line = parseInt(j.line);
      j.start_column = parseInt(j.start_column);
      j.end_column = parseInt(j.end_column);
      const key = traceKey(j);
      const res = results.get(key);
      if (res === undefined) {
        results.set(key, { ...j, hit: 1 });
      } else {
        results.set(key, { ...j, hit: res.hit + 1 });
      }
    } else {
      stdoutLines.push(line);
    }
  }
  return {
    traceResults: [...results.values()],
    stdout: stdoutLines.join("\n"),
  };
}

function renderTraceResults(
  model: monaco.editor.ITextModel,
  oldDecorations: string[],
  results: TraceResult[],
): string[] {
  const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const res of results) {
    const line = res.line;
    const character = model.getLineLastNonWhitespaceColumn(line);
    newDecorations.push({
      range: new monaco.Range(line, character - 1, line, character),
      options: {
        after: {
          content: `${res.name} = ${res.value}${res.hit > 1 ? ` (${res.hit} hits)` : ""}`,
          inlineClassName: "moonbit-trace",
          cursorStops: monaco.editor.InjectedTextCursorStops.None,
        },
      },
    });
  }
  return model.deltaDecorations(oldDecorations, newDecorations);
}

export { init, traceCommandFactory };
