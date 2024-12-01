self.onmessage = async (e) => {
  const stream = await runWasm(e.data);
  self.postMessage(stream, [stream]);
};

async function runWasm(params) {
  const { wasm } = params;
  const stream = new ReadableStream({
    type: "bytes",
    async start(controller) {
      const tag = new WebAssembly.Tag({ parameters: [] });
      const runtime = {
        spectest: {
          print_char: (charCode) => {
            controller.enqueue(new Uint16Array([charCode]));
          },
        },
        exception: {
          tag,
          throw: () => {
            throw new WebAssembly.Exception(tag, [], { traceStack: true });
          },
        },
      };
      const { instance } = await WebAssembly.instantiate(wasm, runtime);
      const main = instance.exports._start;
      if (!main) {
        controller.close();
        return;
      }
      main();
      controller.close();
    },
  });
  return stream;
}
