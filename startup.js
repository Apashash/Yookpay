"use strict";

const path = require("path");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

if (!process.env.PORT) {
  process.env.PORT = process.env.NODE_PORT || process.env.PASSENGER_PORT || "8080";
}

require(path.resolve(__dirname, "dist", "index.cjs"));
