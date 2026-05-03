process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "3000";

await import("./artifacts/api-server/dist/index.mjs");
