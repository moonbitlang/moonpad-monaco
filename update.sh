set -xeuo pipefail

pushd ./core
  bash ./scripts/update.sh
popd

pushd ./moonpad
  pnpm up @moonbit/moonc-worker @moonbit/analyzer
popd

pushd ./moon
  pnpm up @moonbit/moonc-worker
popd
