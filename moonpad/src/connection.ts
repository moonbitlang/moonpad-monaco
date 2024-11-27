import lspWorker from "@moonbit/analyzer/lsp-server?worker";
import * as comlink from "comlink";
import * as jsonrpc from "vscode-jsonrpc/browser";
import * as lsp from "vscode-languageserver-protocol";
import * as core from "./core-fs";

function withResolver<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return [promise, resolve!] as const;
}

const [connection, connectionResolver] = withResolver<lsp.ProtocolConnection>();

async function init() {
  const worker = new lspWorker();
  const corefs = core.CoreFs.getCoreFs();
  const comlinkChannel = new MessageChannel();
  comlink.expose({ fs: corefs, moon: {} }, comlinkChannel.port1);
  worker.postMessage({ MOON_HOME: `${corefs.scheme}:/` }, [
    comlinkChannel.port2,
  ]);

  const c = lsp.createProtocolConnection(
    new jsonrpc.BrowserMessageReader(worker),
    new jsonrpc.BrowserMessageWriter(worker),
  );
  c.listen();
  await c.trace(lsp.Trace.Verbose, console);
  await c.sendRequest(lsp.InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
  } satisfies lsp.InitializeParams);
  await c.sendNotification(lsp.InitializedNotification.type, {});
  connectionResolver(c);
}

export { connection, init };
