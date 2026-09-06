import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export const WORKSPACE_ROLES = ["Administrator", "Coordinator", "Viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function getWorkspaceRole(userId: string): Promise<WorkspaceRole> {
  const user = await clerkClient.users.getUser(userId);
  const metadataRole = user.publicMetadata?.role;
  if (typeof metadataRole === "string" && WORKSPACE_ROLES.includes(metadataRole as WorkspaceRole)) {
    return metadataRole as WorkspaceRole;
  }

  const firstUserPage = await clerkClient.users.getUserList({ limit: 1, orderBy: "+created_at" });
  const firstUser = firstUserPage.data[0];
  return firstUser?.id === userId ? "Administrator" : "Viewer";
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const role = await getWorkspaceRole(userId);
    if (role !== "Administrator") {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  } catch (error) {
    req.log?.error(error, "Could not resolve workspace role");
    res.status(500).json({ error: "Could not verify workspace permissions" });
  }
}

export async function requireEditor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const role = await getWorkspaceRole(userId);
    if (role === "Viewer") {
      res.status(403).json({ error: "Coordinator access required to change operational records" });
      return;
    }
    next();
  } catch (error) {
    req.log?.error(error, "Could not resolve workspace role");
    res.status(500).json({ error: "Could not verify workspace permissions" });
  }
}