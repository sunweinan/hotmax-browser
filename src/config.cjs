const fs = require("node:fs");
const path = require("node:path");
const { DATA } = require("./paths.cjs");

const browserRoot = path.resolve(__dirname, "..");
const configFile = path.join(DATA, "config.json");
const config = fs.existsSync(configFile)
  ? JSON.parse(fs.readFileSync(configFile, "utf8").replace(/^\uFEFF/, ""))
  : {};

module.exports = {
  browserRoot,
  config,
  appName: "Hotmax Browser",
  homeUrl: "https://hotmax.chat",
};
