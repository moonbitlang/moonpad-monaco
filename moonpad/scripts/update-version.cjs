const path = require("path");
const fs = require("fs");
const jsonPath = path.join(__dirname, "..", "package.json");

const json = require(jsonPath);
const mooncVersion = json.dependencies["@moonbit/moonc-worker"].slice(1);
json.version = mooncVersion;

fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf8");
