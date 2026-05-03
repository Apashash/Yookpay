'use strict';
// CJS entry-point for cPanel / Passenger deployment.
// The actual server is compiled as ESM (dist/index.mjs); this shim loads it dynamically.
(async () => {
  await import('./index.mjs');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
