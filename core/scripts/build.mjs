import * as esbuild from 'esbuild'
import fs from 'node:fs'
import { generate } from './generate.mjs'

const ext = ['.mbt', '.mi', '.json', '.gz']

const loader = ext.reduce((acc, e) => ({ ...acc, [e]: 'binary' }), {})

await esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  loader,
  plugins: [
    {
      name: 'generate',
      setup(build) {
        build.onStart(() => {
          generate()
        })
        build.onEnd(() => {
          fs.copyFileSync('src/core-map.d.ts', 'dist/index.d.ts')
        })
      },
    },
  ],
})
