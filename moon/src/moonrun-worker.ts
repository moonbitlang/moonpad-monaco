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

type RunRequest = {
  js: Uint8Array;
};

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  await runJs(e.data.js);
};

async function runJs(js: Uint8Array) {
  const jsUrl = URL.createObjectURL(
    new Blob([js], {
      type: "application/javascript",
    }),
  );
  const oldLog = globalThis.console.log;
  globalThis.console.log = (...args: unknown[]) => {
    const output =
      args.length <= 1 ? String(args[0]) : args.map((v) => String(v)).join(" ");
    self.postMessage(output);
  };
  try {
    await import(/* @vite-ignore */ jsUrl);
  } catch (error) {
    self.postMessage(
      error instanceof Error ? error : new Error(String(error)),
    );
    return;
  } finally {
    URL.revokeObjectURL(jsUrl);
    globalThis.console.log = oldLog;
  }
  self.postMessage(null);
}
