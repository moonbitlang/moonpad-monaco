function getLoadPkgsParams(target = 'wasm-gc') {
  return corePkgs.map(pkg => {
    const base = pkg.split('/').at(-1)
    return [
      `/lib/core/${pkg}:${pkg}`,
      coreMap[`/lib/core/target/${target}/release/bundle/${pkg}/${base}.mi`],
    ]
  })
}

export { coreMap } from './core-map'
export { getLoadPkgsParams }
