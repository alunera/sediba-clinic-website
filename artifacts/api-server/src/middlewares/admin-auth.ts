import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as { adminAuthenticated?: boolean };
  if (!session.adminAuthenticated) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
