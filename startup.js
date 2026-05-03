"use strict";

const path = require("path");
const fs = require("fs");

// ─── Détection du port Plesk / Passenger ────────────────────────────────────
if (!process.env.PORT) {
  const port =
    process.env.NODE_PORT ||
    process.env.PASSENGER_PORT ||
    process.env.HTTP_PORT ||
    "8080";
  process.env.PORT = port;
}

// ─── NODE_ENV ────────────────────────────────────────────────────────────────
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

// ─── Vérifications de base ───────────────────────────────────────────────────
const distFile = path.resolve(__dirname, "dist", "index.cjs");

if (!fs.existsSync(distFile)) {
  console.error(
    "[startup] ERREUR FATALE : dist/index.cjs introuvable.\n" +
    "Lancez 'npm run build' puis commitez le dossier dist/."
  );
  process.exit(1);
}

if (!process.env.SUPABASE_DATABASE_URL && !process.env.DATABASE_URL) {
  console.error(
    "[startup] ERREUR FATALE : SUPABASE_DATABASE_URL n'est pas défini.\n" +
    "Ajoutez cette variable dans Plesk > Node.js > Environment Variables."
  );
  process.exit(1);
}

console.log(
  "[startup] Démarrage YookPay — PORT=" + process.env.PORT +
  " NODE_ENV=" + process.env.NODE_ENV
);

// ─── Lancement ───────────────────────────────────────────────────────────────
require(distFile);
