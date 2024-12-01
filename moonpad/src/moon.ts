import * as mooncWeb from "@moonbit/moonc-worker";
import * as comlink from "comlink";
import * as core from "core";
import mooncWorker from "../node_modules/@moonbit/moonc-worker/moonc-worker?worker";
import * as corefs from "./core-fs";
import moonrunWorker from "./moonrun-worker?worker";

async function moonc<T>(
  callback: (moonc: comlink.Remote<any>) => Promise<T>,
): Promise<T> {
  const worker = new mooncWorker();
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
  return core.getLoadPkgsParams();
}

async function compile(content: string): Promise<Uint8Array> {
  const mbtFiles: [string, string][] = [["main.mbt", content]];
  const miFiles: [string, Uint8Array][] = [];
  const stdMiFiles = getStdMiFiles();
  const { core, mi, diagnostics } = await mooncBuildPackage({
    mbtFiles,
    miFiles,
    stdMiFiles,
    target: "wasm-gc",
    pkg: "main",
    pkgSources: [],
    isMain: true,
    errorFormat: "human",
  });

  if (core === undefined || mi === undefined) {
    throw new Error(diagnostics.join("\n"));
  }

  const coreCoreUri =
    "moonbit-core:/lib/core/target/wasm-gc/release/bundle/core.core";

  const coreCore = await corefs.CoreFs.getCoreFs().readFile(coreCoreUri);
  const { wasm } = await mooncLinkCore({
    coreFiles: [coreCore, core],
    debug: false,
    exportedFunctions: [],
    main: "main",
    outputFormat: "wasm",
    pkgSources: ["moonbitlang/core:moonbit-core:/lib/core"],
    sourceMap: false,
    sources: {},
    target: "wasm-gc",
    testMode: false,
  });
  return wasm;
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

export { compile, run };
