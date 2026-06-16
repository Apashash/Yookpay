"use strict";

// Point d'entrée Plesk — YookPay
// Plesk doit pointer sur ce fichier comme "Application Startup File"

const path = require("path");
const fs   = require("fs");

// ── Charge un fichier .env depuis la racine du repo ──────────────────────────
// Plesk/Passenger n'injecte pas toujours les variables dans process.env.
// Créez un fichier .env à la racine du repo sur Plesk avec vos clés.
// Les variables déjà définies dans l'environnement système ont la priorité.
function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key   = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
    console.log("[startup] .env chargé depuis", envPath);
  } catch (err) {
    console.warn("[startup] Impossible de lire .env :", err.message);
  }
}

loadDotEnv();

// Définit explicitement le chemin du frontend depuis la racine du repo
process.env.FRONTEND_DIST_PATH = path.join(__dirname, "artifacts", "yookpay", "dist", "public");

const entryPoint = path.join(__dirname, "artifacts", "api-server", "dist", "index.cjs");
require(entryPoint);
