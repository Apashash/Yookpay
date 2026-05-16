"use strict";

// Shim Plesk — YookPay
// Plesk pointe sur dist/index.cjs comme startup file.
// Ce fichier définit le chemin du frontend puis charge le vrai serveur.

const path = require("path");

// __dirname ici = {repo_root}/dist/
process.env.FRONTEND_DIST_PATH = path.join(__dirname, "..", "artifacts", "yookpay", "dist", "public");

require(path.join(__dirname, "..", "artifacts", "api-server", "dist", "index.cjs"));
