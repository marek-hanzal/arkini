# Add tests and debug tools

Status: TODO

## Goal

Add enough safety checks to stop future refactors from silently corrupting saves, config references, or command behavior.

## Current state

- Typecheck/build are the main safety net.
- Zod schemas validate many view/config shapes.
- There are no focused gameplay tests yet.

## Proposed work

- Add lightweight unit tests if a test runner is introduced deliberately.
- If avoiding a test runner for now, add dev-only invariant/debug scripts that can run with `tsx`/Vite tooling later.
- Validate GameConfig references:
  - item IDs
  - asset IDs
  - loot table IDs
  - activation inputs/requirements
  - craft recipes
  - upgrade costs/effects
- Validate command all-or-nothing behavior for:
  - activation with insufficient placement
  - craft claim with no output space
  - requirement present but non-consumed
  - input consumed only after successful output plan

## Acceptance

- There is a documented command to run validation, or a deliberate decision not to add one yet.
- Validation catches broken config references before runtime.
- Typecheck and build pass.

## Watchouts

- Do not add a heavyweight test stack casually.
- Keep validation close to data/domain, not UI.
