import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const compiler = JSON.parse(
  await fs.readFile(
    path.join(
      path.dirname(require.resolve("@moonbit/moonc-worker")),
      "package.json",
    ),
    "utf8",
  ),
);
const response = await fetch("https://cli.moonbitlang.com/version.json");
if (!response.ok)
  throw new Error(`Cannot read toolchain release: ${response.status}`);
const release = await response.json();
const version = release.items
  .find((item) => item.name === "moonc")
  ?.version.split(" ")[0]
  .replace(/^v/, "");
if (
  !version ||
  !version.includes("+") ||
  version.split("+")[1] !== compiler.version.split("+")[1]
) {
  throw new Error(
    `Toolchain ${version} does not match compiler ${compiler.version}; retry after the release finishes.`,
  );
}
await fs.writeFile(
  new URL("../../.moon-version", import.meta.url),
  `${version}\n`,
);
