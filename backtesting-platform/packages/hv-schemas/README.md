# @hv/schemas

Shared Zod schemas for HyperView. Consumed by `hyperview-web`, `apps/hyperview-worker`, and (via codegen) the native iOS + Android clients.

## Status

**M0 scaffolding** — placeholder index. First real schemas (`User`, `Symbol`, `Watchlist`, `AlertSpec`, `OrderIntent`) land in M0 alongside the worker endpoint they validate.

## Codegen targets

Two scripts mirror the canonical Zod definitions to native clients:

- `pnpm hv:codegen:swift` → `hyperview-ios/Generated/HVSchemas.swift`
- `pnpm hv:codegen:kotlin` → `hyperview-android/app/src/main/java/.../generated/HVSchemas.kt`

Generated files are committed to the native repos so iOS/Android developers don't need pnpm installed.

## Conventions

- Every schema name is `PascalCase` and exported from `src/index.ts`.
- A schema is paired with an inferred TS type via `z.infer<typeof X>`, exported as `XT`.
- Symbols match the regex `^[A-Z0-9._-]{1,64}$` (same as the backtester's `SymbolString` — reuse, do not redefine).
- Money/sizes are bigint strings on the wire, decoded into a `Decimal` wrapper inside the package — never `number`.
