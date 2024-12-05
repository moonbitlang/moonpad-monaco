import * as mooncWeb from "@moonbit/moonc-worker";
import * as comlink from "comlink";
import * as core from "core";
import * as corefs from "./core-fs";
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
  return core.getLoadPkgsParams();
}

type CompileResult =
  | {
      kind: "success";
      wasm: Uint8Array;
    }
  | {
      kind: "error";
      diagnostics: Diagnostic[];
    };

type CompileParams = {
  libContents: string[];
  testContents?: string[];
  target?: "wasm-gc" | "js";
};

async function compile(params: CompileParams): Promise<CompileResult> {
  const { libContents, testContents = [], target = "wasm-gc" } = params;
  const libInputMbtFiles: [string, string][] = libContents.map(
    (content, index) => [`${index}.mbt`, content],
  );
  const libInputMiFiles: [string, Uint8Array][] = [];
  const diagnostics: string[] = [];
  const isTest = testContents.length > 0;
  const stdMiFiles = getStdMiFiles();
  const libResult = await mooncBuildPackage({
    mbtFiles: libInputMbtFiles,
    miFiles: libInputMiFiles,
    stdMiFiles,
    target,
    pkg: "moonpad/lib",
    pkgSources: ["moonpad/lib:moonpad-internal:/lib"],
    isMain: !isTest,
    errorFormat: "json",
  });

  const { core: libCore, mi: libMi } = libResult;
  diagnostics.push(...libResult.diagnostics);

  if (libCore === undefined || libMi === undefined) {
    return {
      kind: "error",
      diagnostics: diagnostics.map((d) => JSON.parse(d) as Diagnostic),
    };
  }
  let testCore: Uint8Array | undefined;
  if (isTest) {
    const testInputMbtFiles: [string, string][] = testContents.map(
      (content, index) => [`${index}_test.mbt`, content],
    );

    const testInfo = await mooncGenTestInfo({ mbtFiles: testInputMbtFiles });
    const driver = template
      .replace(
        `let tests = {  } // WILL BE REPLACED
  let no_args_tests = {  } // WILL BE REPLACED
  let with_args_tests = {  } // WILL BE REPLACED`,
        testInfo,
      )
      .replace(`{PACKAGE}`, "moonpad/lib_blackbox_test")
      .replace("{BEGIN_MOONTEST}", MOON_TEST_DELIMITER_BEGIN)
      .replace("{END_MOONTEST}", MOON_TEST_DELIMITER_END);

    testInputMbtFiles.push(["driver.mbt", driver]);

    const testInputMiFiles: [string, Uint8Array][] = [
      ["moonpad-internal:/lib:lib", libMi],
    ];

    const testResult = await mooncBuildPackage({
      mbtFiles: testInputMbtFiles,
      miFiles: testInputMiFiles,
      stdMiFiles,
      target,
      pkg: "moonpad/lib_blackbox_test",
      pkgSources: [
        "moonpad/lib:moonpad-internal:/lib",
        "moonpad/lib_blackbox_test:moonpad-internal:/lib",
      ],
      errorFormat: "json",
      isMain: true,
    });

    testCore = testResult.core;
    diagnostics.push(...testResult.diagnostics);

    if (testCore === undefined) {
      return {
        kind: "error",
        diagnostics: diagnostics.map((d) => JSON.parse(d) as Diagnostic),
      };
    }
  }

  const coreCoreUri = `moonbit-core:/lib/core/target/${target}/release/bundle/core.core`;
  const coreCore = await corefs.CoreFs.getCoreFs().readFile(coreCoreUri);
  const coreFiles =
    testCore === undefined
      ? [coreCore, libCore]
      : [coreCore, libCore, testCore];
  const { wasm } = await mooncLinkCore({
    coreFiles,
    debug: false,
    exportedFunctions: [],
    main: isTest ? "moonpad/lib_blackbox_test" : "moonpad/lib",
    outputFormat: "wasm",
    pkgSources: [
      "moonbitlang/core:moonbit-core:/lib/core",
      "moonpad/lib:moonpad-internal:/lib",
      "moonpad/lib_blackbox_test:moonpad-internal:/lib",
    ],
    sourceMap: false,
    sources: {},
    target,
    testMode: true,
  });
  return {
    kind: "success",
    wasm,
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

function lineTransformStream() {
  let buffer = "";
  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? buffer;
      for (const line of lines) {
        controller.enqueue(line);
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(buffer);
      }
      controller.terminate();
    },
  });
}

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

async function run(wasm: Uint8Array): Promise<ReadableStream<Uint16Array>> {
  const worker = new moonrunWorker();
  worker.postMessage({ wasm });
  return await new Promise<ReadableStream<Uint16Array>>((resolve) => {
    worker.onmessage = (e: MessageEvent<ReadableStream<Uint16Array>>) => {
      const stream = e.data;
      const terminationStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush(controller) {
          worker.terminate();
          controller.terminate();
        },
      });

      resolve(stream.pipeThrough(terminationStream));
    };
  });
}

async function test(wasm: Uint8Array): Promise<ReadableStream<TestOutput>> {
  return (await run(wasm))
    .pipeThrough(new TextDecoderStream("utf-16"))
    .pipeThrough(lineTransformStream())
    .pipeThrough(parseTestOutputTransformStream());
}

function init(factory: () => Worker) {
  if (mooncWorkerFactory !== undefined) return;
  mooncWorkerFactory = factory;
}

export { compile, init, run, test };
