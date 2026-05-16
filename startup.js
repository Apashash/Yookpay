"use strict";

// Point d'entrée Plesk — YookPay
// Plesk doit pointer sur ce fichier comme "Application Startup File"

const path = require("path");

// Définit explicitement le chemin du frontend depuis la racine du repo
// __dirname ici = racine du repo (là où startup.js se trouve)
process.env.FRONTEND_DIST_PATH = path.join(__dirname, "artifacts", "yookpay", "dist", "public");

const entryPoint = path.join(__dirname, "artifacts", "api-server", "dist", "index.cjs");
require(entryPoint);
