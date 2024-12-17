self.onmessage = async (e) => {
  runJs(e.data);
};

async function runJs(js) {
  const jsUrl = URL.createObjectURL(
    new Blob([js], {
      type: "application/javascript",
    }),
  );
  const oldLog = globalThis.console.log;
  globalThis.console.log = (arg) => {
    self.postMessage(arg);
  };
  await import(/* @vite-ignore */ jsUrl);
  URL.revokeObjectURL(jsUrl);
  globalThis.console.log = oldLog;
  self.postMessage(null);
}
