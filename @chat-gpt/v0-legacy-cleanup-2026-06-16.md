# v0 legacy cleanup

Status: DONE

## Summary

The active v0 migration no longer keeps the pre-v0 root runtime or the `src/ancient` archaeology snapshot in the source tree. The repository source layout is intentionally narrow now:

- `src/app` for the React/router entry boundary.
- `src/assets` for PNG gameplay assets.
- `src/v0` for the active game runtime.
- `src/vite-env.d.ts` for Vite/browser type augmentation.

Everything else from the root legacy runtime was deleted instead of being preserved as a second source of truth. The old code is still recoverable through git history, because that is what git is for, despite humanity repeatedly trying to use folders named `old-final-backup`.

## Guardrails

- Do not recreate `src/ancient`.
- Do not add root gameplay domains beside `src/v0`.
- Do not add generic compatibility shims to keep pre-v0 names alive.
- If code belongs to the active runtime, put it in the owning `src/v0` domain.
- If code is only historical reference, use git history instead of copying it back into the tree.

## Validation target

The cleanup should keep typecheck/build/format green and should keep active grep checks clean for old root runtime imports.
