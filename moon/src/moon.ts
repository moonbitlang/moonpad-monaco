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
import mooncWorker from "../node_modules/@moonbit/moonc-worker/moonc-worker?worker&inline";
import moonrunWorker from "./moonrun-worker?worker&inline";

type CompileResult =
  | {
      kind: "success";
      js: Uint8Array;
    }
  | {
      kind: "error";
      message: string;
    };

type RunSingleFileResult =
  | {
      kind: "success";
      output: string;
    }
  | {
      kind: "error";
      stage: "compile" | "runtime";
      message: string;
    };

async function moonc<T>(
  callback: (moonc: comlink.Remote<any>) => Promise<T>,
): Promise<T> {
  const worker = new mooncWorker();
  const moonc = comlink.wrap<any>(worker);
  try {
    return await callback(moonc);
  } finally {
    worker.terminate();
  }
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

function formatDiagnostics(diagnostics: string[]): string {
  if (diagnostics.length <= 0) {
    return "Compilation failed but no diagnostics were returned.";
  }
  return diagnostics.join("");
}

async function getCoreCore(): Promise<Uint8Array> {
  const corePath = "/lib/core/_build/js/release/bundle/core.core";
  const coreCore = Core.coreMap[corePath];
  if (coreCore !== undefined) {
    return coreCore;
  }
  const compressedCore = Core.coreMap[`${corePath}.gz`];
  if (compressedCore === undefined) {
    throw new Error("Cannot find moonbit core bundle.");
  }
  const blob = new Blob([compressedCore as any], {
    type: "application/octet-stream",
  });
  const ungzip = new DecompressionStream("gzip");
  const resp = new Response(blob.stream().pipeThrough(ungzip));
  const arrayBuffer = await resp.arrayBuffer();
  const decompressed = new Uint8Array(arrayBuffer);
  Core.coreMap[corePath] = decompressed;
  delete Core.coreMap[`${corePath}.gz`];
  return decompressed;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function compileSingleFile(code: string): Promise<CompileResult> {
  const buildResult = await mooncBuildPackage({
    mbtFiles: [["main.mbt", code]],
    miFiles: [],
    stdMiFiles: getStdMiFiles(),
    target: "js",
    pkg: "moon/lib",
    pkgSources: ["moon/lib:"],
    isMain: true,
    enableValueTracing: false,
    errorFormat: "human",
    noOpt: false,
    indirectImportMiFiles: [],
  });

  const { core, mi, diagnostics } = buildResult;
  if (core === undefined || mi === undefined) {
    return {
      kind: "error",
      message: formatDiagnostics(diagnostics),
    };
  }

  const coreCore = await getCoreCore();

  const { result } = await mooncLinkCore({
    coreFiles: [coreCore, core],
    exportedFunctions: [],
    main: "moon/lib",
    outputFormat: "wasm",
    pkgSources: ["moonbitlang/core:moonbit-core:/lib/core", "moon/lib:moon:/"],
    sources: {},
    target: "js",
    testMode: false,
    sourceMap: false,
    debug: false,
    noOpt: false,
    stopOnMain: false,
  });

  return {
    kind: "success",
    js: result,
  };
}

async function run(js: Uint8Array): Promise<string> {
  const worker = new moonrunWorker();
  return await new Promise((resolve, reject) => {
    const logs: string[] = [];
    worker.onmessage = (e: MessageEvent<string | null | Error>) => {
      if (e.data instanceof Error) {
        worker.terminate();
        reject(e.data);
        return;
      }
      if (e.data === null) {
        worker.terminate();
        resolve(logs.join("\n"));
        return;
      }
      logs.push(e.data);
    };
    worker.postMessage({ js });
  });
}

async function runSingleFile(code: string): Promise<RunSingleFileResult> {
  let compileResult: CompileResult;
  try {
    compileResult = await compileSingleFile(code);
  } catch (error) {
    return {
      kind: "error",
      stage: "compile",
      message: toErrorMessage(error),
    };
  }

  if (compileResult.kind === "error") {
    return {
      kind: "error",
      stage: "compile",
      message: compileResult.message,
    };
  }

  try {
    const output = await run(compileResult.js);
    return {
      kind: "success",
      output,
    };
  } catch (error) {
    return {
      kind: "error",
      stage: "runtime",
      message: toErrorMessage(error),
    };
  }
}

export { runSingleFile };
