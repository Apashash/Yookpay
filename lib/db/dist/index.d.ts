import mysql from "mysql2/promise";
import * as schema from "./schema";
export declare const pool: mysql.Pool;
export declare const db: import("drizzle-orm/mysql2").MySql2Database<typeof schema> & {
    $client: mysql.Pool;
};
/**
 * pgQuery — compatibility helper for raw SQL previously written for node-postgres.
 * Accepts `$1, $2, ...` placeholders, converts them to mysql2 `?` placeholders
 * (duplicating params when a placeholder is reused), and returns `{ rows, insertId, affectedRows }`
 * like pg's `{ rows }` shape. SQL text must already be MySQL-dialect otherwise.
 */
export declare function pgQuery<T = any>(text: string, params?: unknown[]): Promise<{
    rows: T[];
    insertId: number;
    affectedRows: number;
}>;
export * from "./schema";
//# sourceMappingURL=index.d.ts.map