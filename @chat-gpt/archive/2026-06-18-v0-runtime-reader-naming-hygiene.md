# v0 runtime reader naming hygiene checkpoint

Date: 2026-06-18
Commit: this commit

## Context

Follow-up after `v0-runtime-reader-hygiene-2026-06-18.md`.

The focused reader split was directionally correct, but the first pass kept names like `readGameRuntimeBoardView` inside `src/v0/play/runtime/readers`. That repeats the folder context and violates the code guidance against noisy names that restate parent namespaces. Cute little naming bloat, the kind that pretends to be explicit while making every import uglier.

## What changed

Reader files/functions were renamed to keep only the useful domain/action part:

- `readGameRuntimeBoardView` -> `readBoardView`
- `readGameRuntimeBoardItem` -> `readBoardItem`
- `readGameRuntimeBoardFirstEmptyCell` -> `readBoardFirstEmptyCell`
- `readGameRuntimeInventoryView` -> `readInventoryView`
- `readGameRuntimeInventorySlot` -> `readInventorySlot`
- `readGameRuntimeItemCatalogView` -> `readItemCatalogView`
- `readGameRuntimeItemView` -> `readItemView`

The test file moved from `readGameRuntimeReaders.test.ts` to `readers.test.ts`.

## Rule

Inside `src/v0/play/runtime/readers`, do not prefix reader functions/files with `GameRuntime`. The path already says runtime. Use short intent names and keep `file name === exported function name` for single-reader modules.

`GameRuntimeStore`, `GameRuntimeState`, `useGameRuntimeSelector` and provider/context names keep `GameRuntime`, because there the runtime namespace is the actual concept being named, not repeated folder noise.

## Mental model

Good:

```ts
import { readBoardView, readInventorySlot } from "~/v0/play/runtime/readers";
```

Bad:

```ts
import { readGameRuntimeBoardView } from "~/v0/play/runtime/readers";
```

If a future reader name starts with `readGameRuntime*`, stop and ask whether the parent folder already carries that context. It probably does, because humans keep inventing longer names to feel safer. They are not safer. They are just longer.
