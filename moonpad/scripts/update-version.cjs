const path = require("path");
const fs = require("fs");
const { execFileSync } = require("node:child_process");
const jsonPath = path.join(__dirname, "..", "package.json");

const json = require(jsonPath);
const published = JSON.parse(
  execFileSync("npm", ["view", json.name, "versions", "--json"], {
    encoding: "utf8",
  }),
);
while (published.includes(json.version)) {
  const [major, minor, patch] = json.version.split(".").map(Number);
  json.version = `${major}.${minor}.${patch + 1}`;
}

fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + "\n", "utf8");
