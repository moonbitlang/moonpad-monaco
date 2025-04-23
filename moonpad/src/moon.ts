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
import * as mfs from "./mfs";
import moonrunWorker from "./moonrun-worker?worker&inline";
import template from "./template.mbt?raw";

const MOON_TEST_DELIMITER_BEGIN = "----- BEGIN MOON TEST RESULT -----";
const MOON_TEST_DELIMITER_END = "----- END MOON TEST RESULT -----";

type Position = {
  line: number;
  col: number;
};

type Diagnostic = {
  level: "warning" | "error";
  loc: {
    path: string;
    start: Position;
    end: Position;
  };
  message: string;
  error_code: number;
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

async function mooncGenTestInfo(
  params: mooncWeb.genTestInfoParams,
): Promise<ReturnType<typeof mooncWeb.genTestInfo>> {
  return await moonc(async (moonc) => await moonc.genTestInfo(params));
}

function getStdMiFiles(): [string, Uint8Array][] {
  return Core.getLoadPkgsParams("js");
}

type CompileResult =
  | {
      kind: "success";
      js: Uint8Array;
    }
  | {
      kind: "error";
      diagnostics: Diagnostic[];
    };

type Input = [name: string, content: string];

type CompileParams = {
  libInputs: Input[];
  testInputs?: Input[];
  debugMain?: boolean;
  enableValueTracing?: boolean;
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
    reader.readAsDataURL(new Blob([buffer], { type }));
  });
}

async function compile(params: CompileParams): Promise<CompileResult> {
  const fs = mfs.MFS.getMFs();
  const {
    libInputs,
    testInputs = [],
    debugMain = false,
    enableValueTracing = false,
  } = params;

  const isTest = testInputs.length > 0;
  const stdMiFiles = getStdMiFiles();
  let res;
  if (isTest) {
    const testInfo = await mooncGenTestInfo({ mbtFiles: testInputs });
    const driver = template
      .replace(
        `let tests = {  } // WILL BE REPLACED
  let no_args_tests = {  } // WILL BE REPLACED
  let with_args_tests = {  } // WILL BE REPLACED`,
        testInfo,
      )
      .replace(`{PACKAGE}`, "moonpad/lib")
      .replace("{BEGIN_MOONTEST}", MOON_TEST_DELIMITER_BEGIN)
      .replace("{END_MOONTEST}", MOON_TEST_DELIMITER_END);

    testInputs.push(["driver.mbt", driver]);

    res = await mooncBuildPackage({
      mbtFiles: [...libInputs, ...testInputs],
      miFiles: [],
      stdMiFiles,
      target: "js",
      pkg: "moonpad/lib",
      pkgSources: ["moonpad/lib:moonpad:/"],
      errorFormat: "json",
      isMain: true,
      enableValueTracing,
      noOpt: false,
    });
  } else {
    res = await mooncBuildPackage({
      mbtFiles: libInputs,
      miFiles: [],
      stdMiFiles,
      target: "js",
      pkg: "moonpad/lib",
      pkgSources: ["moonpad/lib:moonpad:/"],
      isMain: !isTest,
      enableValueTracing,
      errorFormat: "json",
      noOpt: debugMain,
    });
  }
  const { core, mi, diagnostics } = res;
  if (core === undefined || mi === undefined) {
    return {
      kind: "error",
      diagnostics: diagnostics.map((d) => JSON.parse(d) as Diagnostic),
    };
  }

  const coreCoreUri = `moonbit-core:/lib/core/target/js/release/bundle/core.core`;
  const coreCore = await fs.readFile(coreCoreUri);
  const coreFiles = [coreCore, core];
  const sources: {
    [key: string]: string;
  } = {};
  if (debugMain) {
    for (const key in Core.coreMap) {
      if (key.endsWith(".mbt")) {
        sources[`moonbit-core:${key}`] = new TextDecoder().decode(
          Core.coreMap[key],
        );
      }
    }
    for (const [name, content] of [...libInputs, ...testInputs]) {
      sources[`moonpad:/${name}`] = content;
    }
  }
  const { result, sourceMap } = await mooncLinkCore({
    coreFiles,
    exportedFunctions: [],
    main: isTest ? "moonpad/lib_blackbox_test" : "moonpad/lib",
    outputFormat: "wasm",
    pkgSources: [
      "moonbitlang/core:moonbit-core:/lib/core",
      "moonpad/lib:moonpad:/",
    ],
    sources,
    target: "js",
    testMode: isTest,
    sourceMap: debugMain,
    debug: debugMain,
    noOpt: debugMain,
    sourceMapUrl: "%%moon-internal-to-be-replaced.map%%",
    stopOnMain: debugMain,
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
  };
}

type TestOutput =
  | {
      kind: "stdout";
      stdout: string;
    }
  | ({
      kind: "result";
    } & TestResult);

type TestResult = {
  package: string;
  filename: string;
  test_name: string;
  message: string;
};

function parseTestOutputTransformStream(): TransformStream<string, TestOutput> {
  let isInSection = false;
  let stdout = "";
  const stream = new TransformStream<string, TestOutput>({
    transform(line, controller) {
      if (line === MOON_TEST_DELIMITER_BEGIN) {
        controller.enqueue({ kind: "stdout", stdout });
        stdout = "";
        isInSection = true;
      } else if (line === MOON_TEST_DELIMITER_END) {
        isInSection = false;
      } else {
        if (isInSection) {
          const testResult = JSON.parse(line) as TestResult;
          controller.enqueue({ kind: "result", ...testResult });
        } else {
          stdout += line + "\n";
        }
      }
    },
    flush(controller) {
      controller.terminate();
    },
  });
  return stream;
}

function run(js: Uint8Array): ReadableStream<string> {
  const worker = new moonrunWorker();
  worker.postMessage(js);
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

function test(js: Uint8Array): ReadableStream<TestOutput> {
  return run(js).pipeThrough(parseTestOutputTransformStream());
}

function init(factory: () => Worker) {
  if (mooncWorkerFactory !== undefined) return;
  mooncWorkerFactory = factory;
}

export { compile, init, run, test };
