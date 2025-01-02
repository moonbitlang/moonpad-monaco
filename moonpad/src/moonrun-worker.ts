self.onmessage = async (e: MessageEvent<Uint8Array>) => {
  runJs(e.data);
};

async function runJs(js: Uint8Array) {
  const jsUrl = URL.createObjectURL(
    new Blob([js], {
      type: "application/javascript",
    }),
  );
  const oldLog = globalThis.console.log;
  globalThis.console.log = (arg) => {
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
