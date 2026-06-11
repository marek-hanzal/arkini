# Arkini

Merge game experiment running fully in the browser.

## Stack

- TanStack Start + React
- TanStack Query
- Tailwind CSS v4
- SQLite in browser OPFS via SQLocal
- Kysely typed query layer
- Bun-first scripts

## Run

```bash
bun install
bun run dev
```

If Bun is not available, npm can still install and run the app manually from `apps/arkini`, because apparently one package manager was too merciful for JavaScript.

## OPFS notes

The app expects cross-origin isolation so SQLocal can persist SQLite into OPFS. Dev headers are configured in `apps/arkini/vite.config.ts`; deployment headers are in `apps/arkini/vercel.json` and `apps/arkini/public/_headers`.
