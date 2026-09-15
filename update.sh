set -euo pipefail

cd "$(dirname "$0")"
pnpm --dir moonpad add --save-exact @moonbit/moonc-worker@latest
node ./moonpad/scripts/update-toolchain.mjs
