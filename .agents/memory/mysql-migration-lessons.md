---
name: MySQL/MariaDB migration lessons (YookPay)
description: Durable rules for the Supabase/PostgreSQL → MariaDB (Plesk) migration of the API server.
---

## drizzle-orm/mysql2 result shapes
- `await db.insert(...)` and `db.update/delete(...)` return `[ResultSetHeader, FieldPacket[]]` — use `result[0].insertId` / `result[0].affectedRows`. `.returning()` and `.rowCount` are PostgreSQL-only.
- **Why:** the "Registration failed" 500 and a double-wallet-credit race both came from reading PG-shaped results on MySQL.
- **How to apply:** use the `affectedRows()` helper (api-server `lib/dbResult.ts`) for claim checks; insert → `insertId` → select for RETURNING.

## Raw SQL compat layer
- `pgQuery(text, params)` in `lib/db/src/index.ts` accepts `$n` placeholders (auto-converted to `?`, reuse duplicates params) and returns `{ rows, insertId, affectedRows }`. `db.execute()` is shimmed to return `{ rows }`.
- SQL text must be MySQL dialect: `ON DUPLICATE KEY UPDATE ... VALUES(col)`, `JSON_MERGE_PATCH`/`JSON_UNQUOTE(JSON_EXTRACT(...,'$.k'))`, `SUM(CASE WHEN ...)` instead of `FILTER`, `CAST(x AS DECIMAL(30,10))` instead of `::numeric`, `IN (?)` via `pool.query` with array (guard empty arrays), `INTERVAL 24 HOUR`.

## Testing against Plesk-like env in Replit
- Local MariaDB: datadir `/tmp/mysql-data` (wiped on container restart — re-run `mariadb-install-db` + import `yookpay_mysql.sql`), socket `/tmp/mysql.sock`, port 3307. Background processes die between ShellExec calls — chain mariadbd start, node server, and curls in ONE shell command.
- Run bundle: `MYSQL_DATABASE_URL=mysql://root@127.0.0.1:3307/ashtechp_Ashtech237 PORT=809x SKIP_EXPIRY_WORKER=true node artifacts/api-server/dist/index.cjs`.

## Deploy flow (Plesk)
- User pulls from GitHub `Apashash/Yookpay` main; `dist/` at repo root (backend `index.cjs` + frontend `dist/public`) must be rebuilt+committed. The `gitPush` callback may be absent — push via GitHub connection token inside `"use impure"` (`settings.oauth.credentials.access_token`, never printed).
- TS `tsc --noEmit` shows pre-existing duplicate-drizzle-instance type errors (pg vs mysql2 resolutions) — harmless noise; esbuild build is the gate.
