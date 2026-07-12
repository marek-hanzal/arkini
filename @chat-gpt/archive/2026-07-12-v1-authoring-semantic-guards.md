# V1 authoring semantic guards

## Scope

This pass deliberately adds only completed-game authoring invariants. It does not add runtime graph traversal or duplicate live-state checks.

## Stable line identity

- Every exact identity continues to use the shared `IdSchema`.
- A line ID is unique only within its owner item.
- Different owner items may reuse the same line ID.
- Line IDs should describe a stable canonical product or purpose, optionally with a semantic qualifier.
- Do not use `line:default`; default selection is UI/runtime preference, not persistent line identity.
- Runtime jobs continue to identify a line by the pair `ownerItemId + lineId` and trust completed-game validation for owner-local uniqueness.

## Material tag selectors

A material input using a tag selector must match at least one canonical completed-config item. An empty match makes the line permanently unusable and is therefore an offline error.

This rule is intentionally narrow. Optional query, rule, merge, or future selector contexts keep their own domain-specific empty-match policy.

## Material acceptance policy

Offline validation rejects only:

- a material input accepting its own owner item;
- a direct reciprocal pair where A accepts B and B accepts A.

Selectors are expanded to canonical item IDs before these checks, so tag-based self or reciprocal acceptance is covered.

Longer cycles without a direct reciprocal pair, such as A → B → C → A, are intentionally not rejected. Producers may legitimately be used as materials for destruction, transformation, or upgrades. Do not replace this targeted policy with a general graph/SCC validator unless a concrete gameplay invariant requires it.

Runtime remains responsible only for validating the current candidate runtime state. It does not repeat completed-config capability analysis.
