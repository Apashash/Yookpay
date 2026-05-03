"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

(async () => {
  try {
    const serverPath = path.resolve(__dirname, "artifacts", "api-server", "dist", "index.mjs");
    await import(pathToFileURL(serverPath).href);
  } catch (err) {
    console.error("Failed to start YookPay server:", err);
    process.exit(1);
  }
})();
