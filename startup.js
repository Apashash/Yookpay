"use strict";

// Point d'entrée Plesk — YookPay
// Plesk doit pointer sur ce fichier comme "Application Startup File"
// Le backend compilé (ESM) est chargé via import() dynamique depuis le wrapper CJS.

const path = require("path");
const entryPoint = path.join(__dirname, "artifacts", "api-server", "dist", "index.cjs");

require(entryPoint);
