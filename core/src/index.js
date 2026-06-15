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

import { coreMap, corePkgs } from "./core-map";

function getLoadPkgsParams(target = "wasm-gc") {
  return corePkgs.map((pkg) => {
    const base = pkg.split("/").at(-1);
    return [
      `/lib/core/${pkg}:${pkg}`,
      coreMap[`/lib/core/_build/${target}/release/bundle/${pkg}/${base}.mi`],
    ];
  });
}

async function getCoreFile(path) {
  let content = coreMap[path];
  if (content !== undefined) {
    return content;
  }
  const compressedContent = coreMap[`${path}.gz`];
  if (compressedContent === undefined) {
    throw new Error(`Cannot find MoonBit core file: ${path}`);
  }
  const blob = new Blob([compressedContent], {
    type: "application/octet-stream",
  });
  const ungzip = new DecompressionStream("gzip");
  const resp = new Response(blob.stream().pipeThrough(ungzip));
  content = new Uint8Array(await resp.arrayBuffer());
  coreMap[path] = content;
  delete coreMap[`${path}.gz`];
  return content;
}

async function getCoreRuntimeFiles(target = "js") {
  const base = `/lib/core/_build/${target}/release/bundle`;
  return await Promise.all([
    getCoreFile(`${base}/abort/abort.core`),
    getCoreFile(`${base}/core.core`),
  ]);
}

export {
  getLoadPkgsParams,
  getCoreFile,
  getCoreRuntimeFiles,
  coreMap,
  corePkgs,
};
