# Craft manual refill auto-start

## Summary

Fixed a craft lifecycle gap where manual `craft.input.store` could complete all required inputs without starting the craft job. The bug was most visible after `fill -> withdraw -> refill` because the target looked complete again, but no `craft.start` path was invoked.

## Changes

- Extracted `readCraftStoredInputsReadyFx` so both explicit `craft.start` and manual input store can use the same stored-input readiness check.
- Updated `storeCraftInputFx` to attempt a craft start immediately after a manual store completes all required inputs.
- Auto-start attempts preserve stored inputs when start requirements/runtime constraints are not ready by swallowing only `GameActionRejected` start failures. Explicit `craft.start` still rejects normally.
- Added regression coverage for:
  - completed manual inputs that remain stored while start requirements are missing,
  - `fill -> withdraw -> refill` manually completing inputs and auto-starting the craft job.

## Notes

Blueprints use the same craft capability/runtime path, so the fix applies to blueprints and seed-growth craft targets without a separate branch.
