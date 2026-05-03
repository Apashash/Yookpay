process.env.NODE_ENV = process.env.NODE_ENV || "production";

await import("./artifacts/api-server/dist/index.mjs");
