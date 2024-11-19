import cp from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

function gzip(path) {
  const dest = `${path}.gz`
  const data = fs.readFileSync(path)
  const compressed = zlib.gzipSync(data)
  fs.writeFileSync(dest, compressed)
}

/**
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isDotFile(filePath) {
  return filePath.split(path.sep).some(s => s !== '.' && s.startsWith('.'))
}

function generate() {
  const cwd = process.cwd()
  const data = path.join(cwd, 'data')
  const core = path.join(data, 'lib', 'core')
  cp.execSync('moon clean', { cwd: core, encoding: 'utf8' })
  cp.execSync('moon bundle', { cwd: core, encoding: 'utf8' })
  const coreCore = path.join(
    core,
    'target',
    'wasm-gc',
    'release',
    'bundle',
    'core.core',
  )
  gzip(coreCore)

  const packagesPath = path.join(core, 'target', 'packages.json')
  const packagesJson = fs.readFileSync(packagesPath, 'utf8')

  fs.writeFileSync(packagesPath, packagesJson.replaceAll(data, 'moonbit-core:'))

  const items = fs.readdirSync(core, { recursive: true, withFileTypes: true })
  const extensions = ['mbt', 'mi', 'json']

  const files = items
    .filter(
      i =>
        i.isFile() &&
        (extensions.some(e => i.name.endsWith(e)) || i.name === 'core.core.gz'),
    )
    .map(i => path.join(i.parentPath, i.name))
    .filter(f => !isDotFile(f))

  const importStatements = files
    .map((f, i) => `import file${i} from '${f}';`)
    .join('\n')

  const mapStatement = `const coreMap = Object.create(null)`

  const paths = files.map(f => path.join('/', path.relative(data, f)))

  const assignStatements = paths
    .map((p, i) => `coreMap['${p}'] = file${i}`)
    .join('\n')

  const exportStatement = `export {coreMap}`

  const statements = [
    importStatements,
    mapStatement,
    assignStatements,
    exportStatement,
  ]

  const content = statements.join('\n')

  fs.writeFileSync(path.join(cwd, 'src', 'core-map.js'), content)
}

export { generate }
