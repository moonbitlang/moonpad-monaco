# Moonpad based on monaco editor

## Install

```shell
npm i @moonbit/moonpad-monaco
```

## Usage

see `examples` for usage

## Development

Install the MoonBit release recorded in `.moon-version` before building. The
compiler npm package, installed compiler and core library must have the same
revision; the core build checks this before generating artifacts.

```shell
# install deps
pnpm i

# build core
cd core
npm run build
cd -

# build moonpad
cd moonpad
npm run build
cd -

# run examples
cd examples/vanilla
npm run dev
```

`init({ onigWasmUrl })` creates its compiler and execution workers internally.
Consumers only provide the Oniguruma WASM URL; no separate compiler worker
script or worker factory is needed.

Run `pnpm build && pnpm test` to build the library and exercise compilation,
diagnostics and value tracing in Chromium using the production example bundle.
Install Chromium once with `pnpm exec playwright install chromium`.

The `update.yml` workflow handles builds, compiler updates and publishing.
Its manual dispatch updates the compiler dependency and `.moon-version` together.
