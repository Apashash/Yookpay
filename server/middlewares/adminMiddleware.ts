import { Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { AuthRequest } from "./authMiddleware";

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    return;
  }

  try {
    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId))
      .limit(1);

    if (!user || user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden", message: "Accès réservé aux administrateurs" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "InternalError", message: "Failed to verify admin access" });
  }
}
