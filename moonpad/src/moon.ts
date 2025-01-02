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
  return core.getLoadPkgsParams("js");
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

type CompileParams = {
  libContents: string[];
  testContents?: string[];
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
  const {
    libContents,
    testContents = [],
    debugMain = false,
    enableValueTracing = false,
  } = params;
  const libInputMbtFiles: [string, string][] = libContents.map(
    (content, index) => [`${index}.mbt`, content],
  );
  const testInputMbtFiles: [string, string][] = testContents.map(
    (content, index) => [`${index}_test.mbt`, content],
  );
  const libInputMiFiles: [string, Uint8Array][] = [];
  const diagnostics: string[] = [];
  const isTest = testContents.length > 0;
  const stdMiFiles = getStdMiFiles();
  const libResult = await mooncBuildPackage({
    mbtFiles: libInputMbtFiles,
    miFiles: libInputMiFiles,
    stdMiFiles,
    target: "js",
    pkg: "moonpad/lib",
    pkgSources: ["moonpad/lib:moonpad-internal:/lib"],
    isMain: !isTest,
    enableValueTracing,
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
      target: "js",
      pkg: "moonpad/lib_blackbox_test",
      pkgSources: [
        "moonpad/lib:moonpad-internal:/lib",
        "moonpad/lib_blackbox_test:moonpad-internal:/lib",
      ],
      errorFormat: "json",
      isMain: true,
      enableValueTracing: false,
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

  const coreCoreUri = `moonbit-core:/lib/core/target/js/release/bundle/core.core`;
  const coreCore = await corefs.CoreFs.getCoreFs().readFile(coreCoreUri);
  const coreFiles =
    testCore === undefined
      ? [coreCore, libCore]
      : [coreCore, libCore, testCore];
  const sources: {
    [key: string]: string;
  } = {};
  if (debugMain) {
    for (const key in core.coreMap) {
      if (key.endsWith(".mbt")) {
        sources[`moonbit-core:${key}`] = new TextDecoder().decode(
          core.coreMap[key],
        );
      }
    }
    for (const [name, content] of [...libInputMbtFiles, ...testInputMbtFiles]) {
      sources[`moonpad-internal:/lib/${name}`] = content;
    }
  }
  const { result, sourceMap } = await mooncLinkCore({
    coreFiles,
    exportedFunctions: [],
    main: isTest ? "moonpad/lib_blackbox_test" : "moonpad/lib",
    outputFormat: "wasm",
    pkgSources: [
      "moonbitlang/core:moonbit-core:/lib/core",
      "moonpad/lib:moonpad-internal:/lib",
      "moonpad/lib_blackbox_test:moonpad-internal:/lib",
    ],
    sources,
    target: "js",
    testMode: isTest,
    sourceMap: debugMain,
    debug: debugMain,
    no_opt: debugMain,
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
