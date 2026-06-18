# V0 stored requirements runtime checkpoint - 2026-06-18

Stored requirements are already represented as runtime save state under `save.storedRequirements[targetItemInstanceId].items` and are validated centrally by `GameSaveConfigSchema`.

Current runtime behavior:

- `stored_requirement.store` consumes one resolved board/inventory input ref and increments the target stored requirement quantity.
- `stored_requirement.withdraw` returns stored quantity through normal placement and removes empty stored state buckets.
- Producer and stash readiness read stored quantities from the target board item save state and reject use with `missing_requirement` while the stored quantity is below the configured requirement.
- Craft stored requirements are reserved at craft start through `requirementRefs` and returned on craft completion as `craft-requirement-return` items.

Current UI parity checkpoint:

- Runtime board projection now marks producer product lines with `requirementsReady` and `missingRequirementItemIds`.
- Product lines include both producer-level and product-level requirements in their line metadata.
- No-input product start buttons are disabled while requirements are missing and show `Store requirements` instead of allowing a click that only bounces through engine rejection.
- Stored requirement persistence/integrity remains schema-owned. UI view flags are display/readiness hints only, not save validation.

Keep the boundary: runtime actions may reject current user intent, UI may expose readiness hints, but persisted save consistency belongs to `GameSaveConfigSchema`.
