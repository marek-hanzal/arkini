# 2026-07-01 - Producer UI truth review

Another post drop-owned-effects review pass focused on UI/runtime truth mismatches.

## Fixed

- Product-line output rows now expose runtime weighted odds per roll instead of only saying `weighted roll`.
  - Disabled weighted entries show `0%/roll` in the product-line detail, matching loot/drop views and engine rollability.
  - Enabled weighted entries calculate odds from the enabled-weight total, not raw config weight.
- Producer product-line views now keep a hidden line visible while an existing runtime job for that line still exists.
  - This prevents in-flight jobs from disappearing from item detail just because the current effect state hides the product line.
  - The line view carries `visible: false` so controls can tell the truth.
- Hidden runtime-only lines cannot be started or set as default from UI controls.
  - Primary action reports `Line hidden` when no stronger runtime progress/block state applies.
  - Default action is disabled and inert.

## Guardrails

- Added tests for weighted output probabilities, detail meta rendering, hidden job-line visibility, run-state blocking, and hidden-line detail controls.
- Full validation/check/build pass completed in the working handoff.
