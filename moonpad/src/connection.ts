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
    rootUri: null,
    capabilities: {},
  } satisfies lsp.InitializeParams);
  await c.sendNotification(lsp.InitializedNotification.type, {});
  connectionResolver(c);
}

export { connection, init };
