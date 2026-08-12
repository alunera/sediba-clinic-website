---
name: api-zod index.ts codegen clobber
description: Orval codegen overwrites lib/api-zod/src/index.ts with a bad second export line after every run
---

After every `pnpm --filter @workspace/api-spec run codegen` run, orval regenerates `lib/api-zod/src/index.ts` with two export lines:

```ts
export * from "./generated/api";
export * from "./generated/api.schemas";  // ← this file does not exist
```

The second export causes a TS2307 error because orval only generates `api.ts` for the zod client (not `api.schemas.ts`).

**Fix:** After codegen, immediately overwrite the file:
```ts
export * from "./generated/api";
```

**Why:** Orval's `mode: "split"` zod client only emits `api.ts`, but its index generator assumes `api.schemas.ts` also exists (as it does for the react-query client). This is an orval bug/quirk specific to this project's config.

**How to apply:** Any time `pnpm run codegen` or `pnpm --filter @workspace/api-spec run codegen` is run, reset the file immediately after.
