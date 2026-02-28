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

type RunRequest =
  | Uint8Array
  | {
      js: Uint8Array;
      // Int32[0] stores remaining credits.
      creditState: SharedArrayBuffer;
    };

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const data = e.data;
  if (data instanceof Uint8Array) {
    runJs(data);
    return;
  }
  runJs(data.js, data.creditState);
};

function waitForCredit(credit: Int32Array | undefined) {
  if (!credit) return;
  while (Atomics.load(credit, 0) <= 0) {
    Atomics.wait(credit, 0, 0);
  }
  Atomics.sub(credit, 0, 1);
}

async function runJs(js: Uint8Array, creditState?: SharedArrayBuffer) {
  const credit =
    creditState !== undefined &&
    typeof SharedArrayBuffer !== "undefined" &&
    typeof Atomics.wait === "function"
      ? new Int32Array(creditState)
      : undefined;
  const jsUrl = URL.createObjectURL(
    new Blob([js], {
      type: "application/javascript",
    }),
  );
  const oldLog = globalThis.console.log;
  globalThis.console.log = (...args: unknown[]) => {
    const arg =
      args.length <= 1 ? args[0] : args.map((v) => String(v)).join(" ");
    waitForCredit(credit);
    self.postMessage(arg);
  };
  try {
    await import(/* @vite-ignore */ jsUrl);
  } catch (e) {
    self.postMessage(e);
    return;
  } finally {
    URL.revokeObjectURL(jsUrl);
    globalThis.console.log = oldLog;
  }
  self.postMessage(null);
}
