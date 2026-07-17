# Unified primary navigation actions

Issue: #273

## Result

- Added one game-wide `PrimaryButton` module under `src/ui/button`.
- Native actions use `PrimaryButton`; router navigation uses `PrimaryButtonLink`.
- `PrimaryButtonLink` follows the official TanStack Router custom-link contract with `createLink` and `LinkComponent`, preserving `to`, `params`, `search`, preload, and registered-router inference.
- About, Settings, and Arkpacks no longer own separate primary return-action class lists.
- Arkpacks uses a four-row layout with the return action in the final bottom-center footer row; the package list remains the only flexible scrolling row.
- No launcher-specific button abstraction, route behavior change, or transition behavior was introduced.

## Verification

- Source and test typechecks cover the custom typed link boundary.
- DOM tests verify shared native-button/link styling, anchor navigation semantics, disabled native-button semantics, and the Arkpacks bottom-center footer placement.
