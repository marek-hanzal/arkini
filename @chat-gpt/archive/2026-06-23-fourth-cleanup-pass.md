# Fourth cleanup pass

Date: 2026-06-23

Scope: another codebase cleanup pass after board race fixes and the map-lightening passes. Focus was dead exports, small duplicate flows, hard-to-read local helper shapes and optional hygiene tooling.

## Changes made

Ran Knip as a dead-code/export detector and removed the public surface it exposed as unused:

- removed stale TileEngine public exports that outside code no longer used
- removed the now-unused game engine barrel
- localized several internal schema exports so they are not part of fake public API
- hid tiny local helper types that only existed to satisfy export habits

Then manually cleaned small mental-load duplicates:

- shared producer target resolution through `readProducerRuntimeTargetFx`
- shared stash open target/charge/requirement resolution through `readStashOpenCoreFx` and `readStashRuntimeTargetFx`
- shared stash open input ref resolution through `resolveStashOpenInputRefsFx`
- shared craft busy-target check through `checkCraftTargetIdleFx`
- shared config item lookup through `readGameConfigItemDefinitionFx`
- simplified repeated product completion event creation in `completeProducerJobFx`
- deduplicated item-to-board drop dispatch in `useGameRuntimeDropActions`
- made `useTileActorDrag.Props` extend the pointer-up contract instead of repeating a long prop list manually
- replaced `as never` dummy drop fixtures in tests with typed board/inventory fixtures

## Optional hygiene toolset

Added optional scripts outside the hard gate:

- `npm run audit:dead` uses Knip with `--no-exit-code`
- `npm run audit:dupes` uses jscpd with `--exit-code 0`
- `npm run audit:optional` runs both

These are searchlights, not build blockers. Keep them out of `npm run check` unless we intentionally decide to fail CI on dead exports or duplication.

Current state after this pass:

- Knip reports no findings.
- jscpd reports no clones with current thresholds.

## Notes for future passes

Do not add a custom Knip config unless the default detection starts missing important project files. A first custom config created redundant entry hints and a false `tailwindcss` unused-devDependency warning because Tailwind is imported through CSS. The default Knip project inference was cleaner here.

jscpd v5 uses `--exit-code`, not the older camelCase `--exitCode`. Keep the package script on the hyphenated form.
