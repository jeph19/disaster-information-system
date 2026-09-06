---
name: Clerk workspace access
description: Authentication and role bootstrap rules for the disaster information workspace.
---

The first Clerk account is treated as the initial Administrator when it has no explicit workspace role metadata. Subsequent accounts default to Viewer until an Administrator assigns Coordinator or Administrator access.

**Why:** The app needs a secure bootstrap path without storing a separate admin secret, while keeping new accounts read-only by default.

**How to apply:** Preserve the first-user bootstrap rule when changing user management, and keep operational record mutations restricted to Administrator or Coordinator roles.