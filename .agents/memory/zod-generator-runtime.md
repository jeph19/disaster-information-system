---
name: Zod generator/runtime compatibility
description: OpenAPI code generation emits Zod 4 APIs for integer schemas in this workspace.
---

The OpenAPI generator currently emits `z.int()` for integer fields, so the workspace Zod catalog must remain on Zod 4 or code generation's chained typecheck fails.

**Why:** The generated client and server validation packages are regenerated together from the OpenAPI contract; a major-version mismatch fails before application code can typecheck.

**How to apply:** Before changing the OpenAPI spec or regenerating, verify the workspace catalog provides Zod 4 and run the API codegen command.