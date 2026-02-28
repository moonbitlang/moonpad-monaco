import { parentPort } from "node:worker_threads";

if (!parentPort) {
  throw new Error("trace-worker must run in a worker thread");
}

const TRACING_START = "######MOONBIT_VALUE_TRACING_START######";
const TRACING_CONTENT_START = "######MOONBIT_VALUE_TRACING_CONTENT_START######";
const TRACING_END = "######MOONBIT_VALUE_TRACING_END######";
const TRACING_CONTENT_END = "######MOONBIT_VALUE_TRACING_CONTENT_END######";

function waitForCredit(credit) {
  if (!credit) return;
  while (Atomics.load(credit, 0) <= 0) {
    Atomics.wait(credit, 0, 0);
  }
  Atomics.sub(credit, 0, 1);
}

parentPort.on("message", (config) => {
  const {
    events,
    valueBytes,
    stdoutEvery,
    withBackpressure,
    creditBuffer,
    multilineValue,
  } = config;
  const credit =
    withBackpressure && creditBuffer ? new Int32Array(creditBuffer) : undefined;
  const baseValue = "x".repeat(Math.max(1, valueBytes));

  for (let i = 0; i < events; i += 1) {
    if (stdoutEvery > 0 && i % stdoutEvery === 0) {
      waitForCredit(credit);
      parentPort.postMessage(`stdout ${i}`);
    }
    const value = multilineValue ? `${baseValue}\n${i}` : baseValue;
    waitForCredit(credit);
    parentPort.postMessage(TRACING_START);
    waitForCredit(credit);
    parentPort.postMessage(
      JSON.stringify({
        name: "x",
        line: 1 + (i % 100),
        start_column: 1,
        end_column: 2,
      }),
    );
    waitForCredit(credit);
    parentPort.postMessage(TRACING_CONTENT_START);
    waitForCredit(credit);
    parentPort.postMessage(value);
    waitForCredit(credit);
    parentPort.postMessage(TRACING_CONTENT_END);
    waitForCredit(credit);
    parentPort.postMessage(TRACING_END);
  }
  waitForCredit(credit);
  parentPort.postMessage(null);
});
