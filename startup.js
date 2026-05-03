"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const port = process.env.PORT || process.env.NODE_PORT || process.env.PASSENGER_PORT;

if (!port) {
  console.error("PORT environment variable is required but was not provided.");
  process.exit(1);
}

process.env.PORT = port;

const serverPath = path.resolve(__dirname, "artifacts", "api-server", "dist", "index.mjs");

(async () => {
  try {
    await import(pathToFileURL(serverPath).href);
  } catch (err) {
    console.error("Failed to start YookPay server:", err);
    process.exit(1);
  }
})();
