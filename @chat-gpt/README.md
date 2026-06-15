# ChatGPT work notes

Status: ACTIVE

This directory is the working task memory for ChatGPT-assisted Arkini refactors.

Do not delete completed task files. Mark their `Status` line instead:

- `TODO` means not started.
- `IN_PROGRESS` means currently being edited.
- `DONE` means completed in a committed change.
- `BLOCKED` means intentionally stopped because a product/design decision is missing.
- `OBSOLETE` means replaced by a newer task, with a note pointing to the replacement.

Each task file should describe one coherent piece of work. A task may be a whole story, but it must have a clear acceptance section so the next model does not have to reconstruct intent from chat archaeology, because apparently civilization still communicates through zip files and vibes.

Current baseline commit when this backlog was created: `6b86b70 Normalize craft inputs and activation requirements`.

## Working rules

- Keep the repo client-only and offline-first.
- Keep PNG assets in `src/assets` unless the user explicitly asks for asset changes.
- Keep TileEngine standalone. Arkini-specific behavior may be injected through props/hooks/adapters, but `src/tile-engine` must not import Arkini domains such as `board`, `inventory`, `activation`, `command`, `manifest`, `item`, or `play`.
- Components should render only. Data derivation, command creation, Effect execution, view-model shaping, and animation planning belong in hooks, Fx roots, or adapters.
- Read hooks use `useSuspenseQuery` by default. App-level Suspense handles initial loading.
- Use `Effect` for domain/persistence roots.
- Use Zod schemas with the `Schema.Type` namespace pattern.
- One exported function/component/type/schema per file unless there is a strong local reason not to.
- Do not create compatibility shims as a dumping ground. Prefer clean migration or deletion.
- When finishing work, commit changes and produce a fresh zip including `.git` plus a SHA256 file.
