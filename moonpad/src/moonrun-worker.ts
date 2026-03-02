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
  traceAggregate?: boolean;
};

type TraceResult = {
  name: string;
  value: string;
  line: number;
  start_column: number;
  end_column: number;
  filepath?: string;
  hit: number;
};

const TRACING_START = "######MOONBIT_VALUE_TRACING_START######";
const TRACING_CONTENT_START = "######MOONBIT_VALUE_TRACING_CONTENT_START######";
const TRACING_END = "######MOONBIT_VALUE_TRACING_END######";
const TRACING_CONTENT_END = "######MOONBIT_VALUE_TRACING_CONTENT_END######";
const TRACE_FLUSH_INTERVAL_MS = 16;
const TRACE_FLUSH_EVERY_COMMITS = 32;

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  if (e.data.traceAggregate) {
    runJsAggregate(e.data.js);
    return;
  }
  runJs(e.data.js);
};

async function runJs(js: Uint8Array) {
  const jsUrl = URL.createObjectURL(
    new Blob([js], {
      type: "application/javascript",
    }),
  );
  const oldLog = globalThis.console.log;
  globalThis.console.log = (...args: unknown[]) => {
    const arg =
      args.length <= 1 ? args[0] : args.map((v) => String(v)).join(" ");
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

function traceKey(
  trace: Pick<
    TraceResult,
    "name" | "line" | "start_column" | "end_column" | "filepath"
  >,
): string {
  return JSON.stringify({
    name: trace.name,
    line: trace.line,
    start_column: trace.start_column,
    end_column: trace.end_column,
    filepath: trace.filepath ?? "",
  });
}

type WorkerTraceParseState = {
  section: "stdout" | "meta" | "value";
  pendingValueLines: string[];
  lastResultKey: string | undefined;
  results: Map<string, TraceResult>;
  pendingDeltas: Map<string, TraceResult>;
  pendingStdout: string[];
  flushTimer: number | undefined;
  commitsSinceFlush: number;
};

async function runJsAggregate(js: Uint8Array) {
  const jsUrl = URL.createObjectURL(
    new Blob([js], {
      type: "application/javascript",
    }),
  );
  const state: WorkerTraceParseState = {
    section: "stdout",
    pendingValueLines: [],
    lastResultKey: undefined,
    results: new Map(),
    pendingDeltas: new Map(),
    pendingStdout: [],
    flushTimer: undefined,
    commitsSinceFlush: 0,
  };
  const flushNow = () => {
    if (state.flushTimer !== undefined) {
      clearTimeout(state.flushTimer);
      state.flushTimer = undefined;
    }
    if (state.pendingDeltas.size > 0) {
      self.postMessage({
        kind: "trace-delta",
        entries: [...state.pendingDeltas.values()],
      });
      state.pendingDeltas.clear();
    }
    if (state.pendingStdout.length > 0) {
      self.postMessage({
        kind: "stdout-batch",
        lines: state.pendingStdout,
      });
      state.pendingStdout = [];
    }
    state.commitsSinceFlush = 0;
  };
  const scheduleFlush = () => {
    if (state.flushTimer !== undefined) return;
    state.flushTimer = setTimeout(() => {
      flushNow();
    }, TRACE_FLUSH_INTERVAL_MS) as unknown as number;
  };
  const commitTraceValue = () => {
    if (!state.lastResultKey) return;
    const res = state.results.get(state.lastResultKey);
    if (!res) return;
    res.value = state.pendingValueLines.join("\n");
    state.pendingDeltas.set(state.lastResultKey, { ...res });
    state.commitsSinceFlush += 1;
    if (state.commitsSinceFlush >= TRACE_FLUSH_EVERY_COMMITS) {
      flushNow();
      return;
    }
    scheduleFlush();
  };
  const feedTraceLine = (line: string) => {
    if (line === TRACING_START) {
      state.section = "meta";
      return;
    }
    if (line === TRACING_END) {
      state.section = "stdout";
      state.pendingValueLines = [];
      state.lastResultKey = undefined;
      return;
    }
    if (line === TRACING_CONTENT_START) {
      state.section = "value";
      state.pendingValueLines = [];
      return;
    }
    if (line === TRACING_CONTENT_END) {
      commitTraceValue();
      state.section = "meta";
      state.pendingValueLines = [];
      return;
    }
    if (state.section === "value") {
      state.pendingValueLines.push(line);
      return;
    }
    if (state.section === "meta") {
      try {
        const j = JSON.parse(line) as Omit<TraceResult, "value" | "hit">;
        const key = traceKey(j);
        state.lastResultKey = key;
        const prev = state.results.get(key);
        if (!prev) {
          state.results.set(key, {
            ...j,
            value: "",
            hit: 1,
          });
        } else {
          state.results.set(key, {
            ...j,
            value: prev.value,
            hit: prev.hit + 1,
          });
        }
      } catch {
        state.pendingStdout.push(line);
        scheduleFlush();
      }
      return;
    }
    state.pendingStdout.push(line);
    scheduleFlush();
  };
  const feedTraceChunk = (chunk: string) => {
    const lines = chunk.split(/\r?\n/);
    const lastIndex =
      chunk.endsWith("\n") || chunk.endsWith("\r")
        ? lines.length - 1
        : lines.length;
    for (let i = 0; i < lastIndex; i += 1) {
      feedTraceLine(lines[i]!);
    }
  };

  const oldLog = globalThis.console.log;
  globalThis.console.log = (...args: unknown[]) => {
    const arg =
      args.length <= 1 ? args[0] : args.map((v) => String(v)).join(" ");
    feedTraceChunk(String(arg));
  };
  try {
    await import(/* @vite-ignore */ jsUrl);
  } catch (e) {
    flushNow();
    self.postMessage(e);
    return;
  } finally {
    flushNow();
    URL.revokeObjectURL(jsUrl);
    globalThis.console.log = oldLog;
  }
  self.postMessage(null);
}
