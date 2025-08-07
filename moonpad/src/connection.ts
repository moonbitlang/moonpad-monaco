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

import * as comlink from "comlink";
import * as jsonrpc from "vscode-jsonrpc/browser";
import * as lsp from "vscode-languageserver-protocol";
import * as mfs from "./mfs";

function withResolver<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return [promise, resolve!] as const;
}

const [connection, connectionResolver] = withResolver<lsp.ProtocolConnection>();

async function init(lspWorker: Worker) {
  const fs = mfs.MFS.getMFs();
  const comlinkChannel = new MessageChannel();
  comlink.expose({ fs, moon: {} }, comlinkChannel.port1);
  lspWorker.postMessage({ MOON_HOME: `${fs.coreScheme}:/` }, [
    comlinkChannel.port2,
  ]);

  const c = lsp.createProtocolConnection(
    new jsonrpc.BrowserMessageReader(lspWorker),
    new jsonrpc.BrowserMessageWriter(lspWorker),
  );
  c.listen();
  DEV: await c.trace(lsp.Trace.Verbose, console);
  await c.sendRequest(lsp.InitializeRequest.type, {
    processId: null,
    rootUri: "file:///",
    workspaceFolders: [
      {
        uri: "file:///",
        name: "MoonPad Workspace",
      },
    ],
    capabilities: {},
  } satisfies lsp.InitializeParams);
  await c.sendNotification(lsp.InitializedNotification.type, {});
  connectionResolver(c);
}

export { connection, init };
