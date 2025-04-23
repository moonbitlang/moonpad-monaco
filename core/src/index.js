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

import { coreMap, corePkgs } from './core-map'

function getLoadPkgsParams(target = 'wasm-gc') {
  return corePkgs.map(pkg => {
    const base = pkg.split('/').at(-1)
    return [
      `/lib/core/${pkg}:${pkg}`,
      coreMap[`/lib/core/target/${target}/release/bundle/${pkg}/${base}.mi`],
    ]
  })
}

export { getLoadPkgsParams, coreMap, corePkgs }
