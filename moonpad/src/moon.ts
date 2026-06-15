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

import * as mooncWeb from "@moonbit/moonc-worker";
import * as comlink from "comlink";
import * as Core from "core";
import moonrunWorker from "./moonrun-worker?worker&inline";
import type { TraceResult, TraceRunOutput } from "./trace-types";

type Position = {
  line: number;
  col: number;
};

type Diagnostic = {
  level: "warning" | "error" | "info";
  path?: string;
  start?: Position;
  end?: Position;
  message: string;
  errorCode?: number;
  raw: string;
};

let mooncWorkerFactory: (() => Worker) | undefined = undefined;

async function moonc<T>(
  callback: (moonc: comlink.Remote<any>) => Promise<T>,
): Promise<T> {
  if (mooncWorkerFactory === undefined) {
    throw new Error("must init before using moonc");
  }
  const worker = mooncWorkerFactory();
  const moonc = comlink.wrap<any>(worker);
  const res = await callback(moonc);
  worker.terminate();
  return res;
}

async function mooncBuildPackage(
  params: mooncWeb.buildPackageParams,
): Promise<ReturnType<typeof mooncWeb.buildPackage>> {
  return await moonc(async (moonc) => await moonc.buildPackage(params));
}

async function mooncLinkCore(
  params: mooncWeb.linkCoreParams,
): Promise<ReturnType<typeof mooncWeb.linkCore>> {
  return await moonc(async (moonc) => await moonc.linkCore(params));
}

function getStdMiFiles(): [string, Uint8Array][] {
  return Core.getLoadPkgsParams("js");
}

function parseLoc(loc: unknown): { start?: Position; end?: Position } {
  if (typeof loc === "string") {
    const match = loc.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
    if (match) {
      return {
        start: { line: Number(match[1]), col: Number(match[2]) },
        end: { line: Number(match[3]), col: Number(match[4]) },
      };
    }
    const sameLineMatch = loc.match(/^(\d+):(\d+)-(\d+)$/);
    if (sameLineMatch) {
      const line = Number(sameLineMatch[1]);
      return {
        start: { line, col: Number(sameLineMatch[2]) },
        end: { line, col: Number(sameLineMatch[3]) },
      };
    }
  }
  if (typeof loc === "object" && loc !== null) {
    const value = loc as {
      path?: unknown;
      start?: { line?: unknown; col?: unknown };
      end?: { line?: unknown; col?: unknown };
    };
    const start =
      typeof value.start?.line === "number" &&
      typeof value.start?.col === "number"
        ? { line: value.start.line, col: value.start.col }
        : undefined;
    const end =
      typeof value.end?.line === "number" && typeof value.end?.col === "number"
        ? { line: value.end.line, col: value.end.col }
        : undefined;
    return { start, end };
  }
  return {};
}

function normalizeDiagnostic(raw: string): Diagnostic {
  try {
    const parsed = JSON.parse(raw) as {
      level?: unknown;
      message?: unknown;
      path?: unknown;
      loc?: unknown;
      error_code?: unknown;
    };
    const locPath =
      typeof parsed.loc === "object" &&
      parsed.loc !== null &&
      typeof (parsed.loc as { path?: unknown }).path === "string"
        ? (parsed.loc as { path: string }).path
        : undefined;
    const { start, end } = parseLoc(parsed.loc);
    return {
      level:
        parsed.level === "warning" || parsed.level === "info"
          ? parsed.level
          : "error",
      path: typeof parsed.path === "string" ? parsed.path : locPath,
      start,
      end,
      message: typeof parsed.message === "string" ? parsed.message : raw,
      errorCode:
        typeof parsed.error_code === "number" ? parsed.error_code : undefined,
      raw,
    };
  } catch {
    return {
      level: "error",
      message: raw,
      raw,
    };
  }
}

function normalizeDiagnostics(diagnostics: string[]): Diagnostic[] {
  return diagnostics.map(normalizeDiagnostic);
}

function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length <= 0) {
    return "Single-file link failed but no diagnostics were returned.";
  }
  return diagnostics.map((d) => d.message).join("\n");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

type SingleFileInput = {
  code: string;
  filename?: string;
  debugMain?: boolean;
  enableValueTracing?: boolean;
  exportedFunctions?: string[];
};

type NormalizedSingleFileInput = {
  code: string;
  filename: string;
  debugMain: boolean;
  enableValueTracing: boolean;
  exportedFunctions: string[];
};

type LinkSingleFileResult =
  | {
      kind: "success";
      js: Uint8Array;
      diagnostics: Diagnostic[];
    }
  | {
      kind: "error";
      stage: "build" | "link";
      diagnostics: Diagnostic[];
      message: string;
    };

type RunSingleFileResult =
  | {
      kind: "success";
      output: string;
      diagnostics: Diagnostic[];
    }
  | {
      kind: "error";
      stage: "link" | "runtime";
      diagnostics?: Diagnostic[];
      message: string;
    };

async function bufferToDataURL(
  buffer: Uint8Array,
  type?: string,
): Promise<string> {
  // use a FileReader to generate a base64 data URI:
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(new Blob([buffer as any], { type }));
  });
}

function normalizeSingleFileInput(
  input: string | SingleFileInput,
): NormalizedSingleFileInput {
  const params = typeof input === "string" ? { code: input } : input;
  const filename = params.filename?.replace(/^\/+/, "") || "main.mbt";
  return {
    code: params.code,
    filename,
    debugMain: params.debugMain ?? false,
    enableValueTracing: params.enableValueTracing ?? false,
    exportedFunctions: params.exportedFunctions ?? [],
  };
}

async function linkSingleFile(
  input: string | SingleFileInput,
): Promise<LinkSingleFileResult> {
  const params = normalizeSingleFileInput(input);
  const buildResult = await mooncBuildPackage({
    mbtFiles: [[params.filename, params.code]],
    miFiles: [],
    stdMiFiles: getStdMiFiles(),
    target: "js",
    pkg: "moonpad/single",
    pkgSources: ["moonpad/single:moonpad:/"],
    isMain: true,
    enableValueTracing: params.enableValueTracing,
    errorFormat: "json",
    noOpt: params.debugMain,
    indirectImportMiFiles: [],
  });
  const { core, mi, diagnostics } = buildResult;
  const parsedDiagnostics = normalizeDiagnostics(diagnostics);
  if (core === undefined || mi === undefined) {
    return {
      kind: "error",
      stage: "build",
      diagnostics: parsedDiagnostics,
      message: formatDiagnostics(parsedDiagnostics),
    };
  }

  const coreFiles = [...(await Core.getCoreRuntimeFiles("js")), core];
  const sources: {
    [key: string]: string;
  } = {};
  if (params.debugMain) {
    for (const key in Core.coreMap) {
      if (key.endsWith(".mbt")) {
        sources[`moonbit-core:${key}`] = new TextDecoder().decode(
          Core.coreMap[key],
        );
      }
    }
    sources[`moonpad:/${params.filename}`] = params.code;
  }

  try {
    const { result, sourceMap } = await mooncLinkCore({
      coreFiles,
      exportedFunctions: params.exportedFunctions,
      main: "moonpad/single",
      outputFormat: "wasm",
      pkgSources: [
        "moonbitlang/core:moonbit-core:/lib/core",
        "moonpad/single:moonpad:/",
      ],
      sources,
      target: "js",
      testMode: false,
      sourceMap: params.debugMain,
      debug: params.debugMain,
      noOpt: params.debugMain,
      sourceMapUrl: "%%moon-internal-to-be-replaced.map%%",
      stopOnMain: params.debugMain,
    });
    let js = result;
    if (sourceMap !== undefined) {
      const sourceMapUrl = await bufferToDataURL(
        new TextEncoder().encode(sourceMap),
        "application/json",
      );
      js = new TextEncoder().encode(
        new TextDecoder("utf8")
          .decode(result)
          .replace("%%moon-internal-to-be-replaced.map%%", sourceMapUrl),
      );
    }
    return {
      kind: "success",
      js,
      diagnostics: parsedDiagnostics,
    };
  } catch (error) {
    return {
      kind: "error",
      stage: "link",
      diagnostics: parsedDiagnostics,
      message: toErrorMessage(error),
    };
  }
}

function run(js: Uint8Array): ReadableStream<string> {
  const worker = new moonrunWorker();
  worker.postMessage({ js });
  return new ReadableStream<string>({
    start(controller) {
      worker.onmessage = (e: MessageEvent<string | null | Error>) => {
        if (e.data instanceof Error) {
          worker.terminate();
          controller.error(e.data);
        } else if (e.data) {
          controller.enqueue(e.data);
        } else {
          worker.terminate();
          controller.close();
        }
      };
    },
  });
}

async function collectOutput(stream: ReadableStream<string>): Promise<string> {
  const output: string[] = [];
  await stream.pipeTo(
    new WritableStream<string>({
      write(chunk) {
        output.push(chunk);
      },
    }),
  );
  return output.join("\n");
}

async function runSingleFile(
  input: string | SingleFileInput,
): Promise<RunSingleFileResult> {
  let linkResult: LinkSingleFileResult;
  try {
    linkResult = await linkSingleFile(input);
  } catch (error) {
    return {
      kind: "error",
      stage: "link",
      message: toErrorMessage(error),
    };
  }

  if (linkResult.kind === "error") {
    return {
      kind: "error",
      stage: "link",
      diagnostics: linkResult.diagnostics,
      message: linkResult.message,
    };
  }

  try {
    const output = await collectOutput(run(linkResult.js));
    return {
      kind: "success",
      output,
      diagnostics: linkResult.diagnostics,
    };
  } catch (error) {
    return {
      kind: "error",
      stage: "runtime",
      diagnostics: linkResult.diagnostics,
      message: toErrorMessage(error),
    };
  }
}

function runTrace(js: Uint8Array): ReadableStream<TraceRunOutput> {
  const worker = new moonrunWorker();
  let isClosed = false;
  const closeWorker = () => {
    if (isClosed) return;
    isClosed = true;
    worker.terminate();
  };
  return new ReadableStream<TraceRunOutput>({
    start(controller) {
      worker.onmessage = (e: MessageEvent<TraceRunOutput | null | Error>) => {
        if (isClosed) return;
        if (e.data instanceof Error) {
          closeWorker();
          controller.error(e.data);
          return;
        }
        if (e.data === null) {
          closeWorker();
          controller.close();
          return;
        }
        controller.enqueue(e.data);
      };
      worker.postMessage({
        js,
        traceAggregate: true,
      });
    },
    cancel() {
      closeWorker();
    },
  });
}

function init(factory: () => Worker) {
  if (mooncWorkerFactory !== undefined) return;
  mooncWorkerFactory = factory;
}

export { init, linkSingleFile, runSingleFile, runTrace };
export type {
  Diagnostic,
  LinkSingleFileResult,
  RunSingleFileResult,
  SingleFileInput,
  TraceResult,
  TraceRunOutput,
};
