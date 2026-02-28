import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";

const TRACING_START = "######MOONBIT_VALUE_TRACING_START######";
const TRACING_CONTENT_START = "######MOONBIT_VALUE_TRACING_CONTENT_START######";
const TRACING_END = "######MOONBIT_VALUE_TRACING_END######";
const TRACING_CONTENT_END = "######MOONBIT_VALUE_TRACING_CONTENT_END######";

const workerPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "trace-worker.mjs",
);

const defaultOptions = {
  events: 20_000,
  valueBytes: 16,
  stdoutEvery: 0,
  parser: "collect",
  backpressure: false,
  credits: 64,
  multilineValue: false,
};

function parseArgs(argv) {
  const options = { ...defaultOptions };
  let demo = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "demo") {
      demo = true;
      continue;
    }
    if (arg === "--events") options.events = Number(argv[++i]);
    else if (arg === "--value-bytes") options.valueBytes = Number(argv[++i]);
    else if (arg === "--stdout-every") options.stdoutEvery = Number(argv[++i]);
    else if (arg === "--parser") options.parser = argv[++i];
    else if (arg === "--backpressure") options.backpressure = argv[++i] === "1";
    else if (arg === "--credits") options.credits = Number(argv[++i]);
    else if (arg === "--multiline-value")
      options.multilineValue = argv[++i] === "1";
  }
  return { demo, options };
}

function traceKey(trace) {
  return JSON.stringify({
    name: trace.name,
    line: trace.line,
    start_column: trace.start_column,
    end_column: trace.end_column,
  });
}

function parseTraceCollect(lines) {
  const results = new Map();
  const stdout = [];
  let isInTrace = false;
  let isInTraceContent = false;
  let lastResultKey;
  for (const line of lines) {
    if (line === TRACING_START) {
      isInTrace = true;
      continue;
    }
    if (line === TRACING_END) {
      isInTrace = false;
      continue;
    }
    if (line === TRACING_CONTENT_START) {
      isInTraceContent = true;
      continue;
    }
    if (line === TRACING_CONTENT_END) {
      isInTraceContent = false;
      continue;
    }
    if (isInTraceContent) {
      if (!lastResultKey) continue;
      const res = results.get(lastResultKey);
      if (res) res.value = line;
      continue;
    }
    if (isInTrace) {
      const j = JSON.parse(line);
      const key = traceKey(j);
      lastResultKey = key;
      const prev = results.get(key);
      if (!prev) results.set(key, { ...j, value: "", hit: 1 });
      else results.set(key, { ...j, value: prev.value, hit: prev.hit + 1 });
      continue;
    }
    stdout.push(line);
  }
  return { traceCount: results.size, stdoutChars: stdout.join("\n").length };
}

function createStreamingParser() {
  const state = {
    section: "stdout",
    lastResultKey: undefined,
    pendingChunkLine: "",
    pendingValueLines: [],
    results: new Map(),
    stdoutLines: [],
  };
  function commitValue() {
    if (!state.lastResultKey) return;
    const res = state.results.get(state.lastResultKey);
    if (res) res.value = state.pendingValueLines.join("\n");
  }
  function feedLine(line) {
    if (line === TRACING_START) {
      state.section = "meta";
      return;
    }
    if (line === TRACING_END) {
      state.section = "stdout";
      state.lastResultKey = undefined;
      state.pendingValueLines = [];
      return;
    }
    if (line === TRACING_CONTENT_START) {
      state.section = "value";
      state.pendingValueLines = [];
      return;
    }
    if (line === TRACING_CONTENT_END) {
      commitValue();
      state.section = "meta";
      state.pendingValueLines = [];
      return;
    }
    if (state.section === "value") {
      state.pendingValueLines.push(line);
      return;
    }
    if (state.section === "meta") {
      const j = JSON.parse(line);
      const key = traceKey(j);
      state.lastResultKey = key;
      const prev = state.results.get(key);
      if (!prev) state.results.set(key, { ...j, value: "", hit: 1 });
      else state.results.set(key, { ...j, value: prev.value, hit: prev.hit + 1 });
      return;
    }
    state.stdoutLines.push(line);
  }
  return {
    feedChunk(chunk) {
      if (
        !String(chunk).includes("\n") &&
        !String(chunk).includes("\r") &&
        state.pendingChunkLine === ""
      ) {
        feedLine(String(chunk));
        return;
      }
      const text = state.pendingChunkLine + String(chunk);
      const lines = text.split(/\r?\n/);
      state.pendingChunkLine = lines.pop() ?? "";
      for (const line of lines) feedLine(line);
    },
    end() {
      if (state.pendingChunkLine.length > 0) feedLine(state.pendingChunkLine);
      return {
        traceCount: state.results.size,
        stdoutChars: state.stdoutLines.join("\n").length,
      };
    },
  };
}

function createLegacyStreamingParser() {
  const state = {
    section: "stdout",
    lastResultKey: undefined,
    pendingChunkLine: "",
    pendingValueLines: [],
    results: new Map(),
    stdoutLines: [],
  };
  function commitValue() {
    if (!state.lastResultKey) return;
    const res = state.results.get(state.lastResultKey);
    if (res) res.value = state.pendingValueLines.join("\n");
  }
  function feedLine(line) {
    if (line === TRACING_START) {
      state.section = "meta";
      return;
    }
    if (line === TRACING_END) {
      state.section = "stdout";
      state.lastResultKey = undefined;
      state.pendingValueLines = [];
      return;
    }
    if (line === TRACING_CONTENT_START) {
      state.section = "value";
      state.pendingValueLines = [];
      return;
    }
    if (line === TRACING_CONTENT_END) {
      commitValue();
      state.section = "meta";
      state.pendingValueLines = [];
      return;
    }
    if (state.section === "value") {
      state.pendingValueLines.push(line);
      return;
    }
    if (state.section === "meta") {
      const j = JSON.parse(line);
      const key = traceKey(j);
      state.lastResultKey = key;
      const prev = state.results.get(key);
      if (!prev) state.results.set(key, { ...j, value: "", hit: 1 });
      else state.results.set(key, { ...j, value: prev.value, hit: prev.hit + 1 });
      return;
    }
    state.stdoutLines.push(line);
  }
  return {
    feedChunk(chunk) {
      // Legacy behavior: assumes chunks are newline-delimited payloads.
      const text = state.pendingChunkLine + String(chunk);
      const lines = text.split(/\r?\n/);
      state.pendingChunkLine = lines.pop() ?? "";
      for (const line of lines) feedLine(line);
    },
    end() {
      if (state.pendingChunkLine.length > 0) feedLine(state.pendingChunkLine);
      return {
        traceCount: state.results.size,
        stdoutChars: state.stdoutLines.join("\n").length,
      };
    },
  };
}

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function runScenario(inputOptions) {
  const options = { ...defaultOptions, ...inputOptions };
  const baselineRss = process.memoryUsage().rss;
  const credit = options.backpressure
    ? new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
    : undefined;
  if (credit) Atomics.store(credit, 0, Math.max(1, options.credits));

  const worker = new Worker(workerPath);
  const started = performance.now();
  let peakRss = process.memoryUsage().rss;
  let messageCount = 0;
  const lines = [];
  const parser =
    options.parser === "stream"
      ? createStreamingParser()
      : options.parser === "legacy-stream"
        ? createLegacyStreamingParser()
        : undefined;

  const sample = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > peakRss) peakRss = rss;
  }, 20);

  const result = await new Promise((resolve, reject) => {
    worker.on("message", (msg) => {
      messageCount += 1;
      if (msg === null) {
        resolve(undefined);
        return;
      }
      if (options.parser === "collect") lines.push(String(msg));
      else parser.feedChunk(String(msg));
      if (credit) {
        Atomics.add(credit, 0, 1);
        Atomics.notify(credit, 0, 1);
      }
    });
    worker.on("error", reject);
    worker.postMessage({
      events: options.events,
      valueBytes: options.valueBytes,
      stdoutEvery: options.stdoutEvery,
      withBackpressure: options.backpressure,
      creditBuffer: credit?.buffer,
      multilineValue: options.multilineValue,
    });
  });
  clearInterval(sample);
  worker.terminate();
  void result;
  const parsed =
    options.parser === "collect" ? parseTraceCollect(lines) : parser.end();
  const elapsedMs = Math.round(performance.now() - started);
  const rss = process.memoryUsage().rss;
  peakRss = Math.max(peakRss, rss);
  const peakExtraBytes = Math.max(0, peakRss - baselineRss);
  return {
    ...options,
    elapsedMs,
    messageCount,
    traceCount: parsed.traceCount,
    stdoutChars: parsed.stdoutChars,
    baselineRssBytes: baselineRss,
    baselineRss: formatMB(baselineRss),
    peakRssBytes: peakRss,
    peakRss: formatMB(peakRss),
    peakExtraBytes,
    peakExtra: formatMB(peakExtraBytes),
  };
}

async function runDemo(baseOptions) {
  const scenarios = [
    { name: "flood-collect", parser: "collect", backpressure: false },
    { name: "flood-legacy", parser: "legacy-stream", backpressure: false },
    { name: "flood-stream", parser: "stream", backpressure: false },
    { name: "bp-collect", parser: "collect", backpressure: true },
    { name: "bp-legacy", parser: "legacy-stream", backpressure: true },
    { name: "bp-stream", parser: "stream", backpressure: true },
  ];
  const out = [];
  for (const s of scenarios) {
    const r = await runScenario({ ...baseOptions, ...s });
    out.push({
      name: s.name,
      elapsedMs: r.elapsedMs,
      peakExtra: r.peakExtra,
      traceCount: r.traceCount,
      messages: r.messageCount,
    });
  }
  console.table(out);
}

async function main() {
  const { demo, options } = parseArgs(process.argv.slice(2));
  if (demo) {
    await runDemo(options);
    return;
  }
  const result = await runScenario(options);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
