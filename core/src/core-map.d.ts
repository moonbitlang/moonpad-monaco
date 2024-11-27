declare const coreMap: Record<string, Uint8Array>
declare function getLoadPkgsParams(
  target?: 'wasm-gc' | 'wasm' | 'js',
): [importPath: string, mi: Uint8Array][]

export { coreMap, getLoadPkgsParams }
