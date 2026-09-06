import { clerkClient, getAuth, type User } from "@clerk/express";
import { Router, type IRouter } from "express";
import {
  ListUsersResponse,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import { getWorkspaceRole, requireAdmin, requireAuth, type WorkspaceRole } from "../middlewares/auth";

const router: IRouter = Router();

function toAppUser(user: User, role: WorkspaceRole) {
  const email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email || "Workspace user";
  return {
    id: user.id,
    name,
    email,
    role,
    status: user.banned ? "Disabled" as const : "Active" as const,
    createdAt: new Date(user.createdAt),
  };
}

router.get("/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  try {
    const page = await clerkClient.users.getUserList({ limit: 100, orderBy: "-created_at" });
    const users = await Promise.all(page.data.map(async (user) => toAppUser(user, await getWorkspaceRole(user.id))));
    res.json(ListUsersResponse.parse(users));
  } catch (error) {
    res.status(500).json({ error: "Could not load workspace users" });
  }
});

router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserRoleParams.safeParse(req.params);
  const body = UpdateUserRoleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid user role request" });
    return;
  }

  const currentUserId = getAuth(req).userId;
  if (currentUserId === params.data.id && body.data.role !== "Administrator") {
    res.status(400).json({ error: "You cannot remove your own administrator access" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(params.data.id);
    const updated = await clerkClient.users.updateUserMetadata(params.data.id, {
      publicMetadata: { ...user.publicMetadata, role: body.data.role },
    });
    res.json(UpdateUserRoleResponse.parse(toAppUser(updated, body.data.role)));
  } catch (error) {
    res.status(404).json({ error: "Workspace user not found" });
  }
});

export default router;