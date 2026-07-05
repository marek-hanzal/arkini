# Detail line action metadata button

Moved producer line queue/duration metadata out of the faint header microcopy and into the primary action button.

Changes:
- `DetailProgressActionControl` now carries `metaLabel` so the component receives ready UI metadata from control.
- `readDetailLineControl` computes line action metadata: product lines show `Queue x/y · duration`; effect lines show `Window duration`; duration multipliers are preserved.
- `DetailLineActions` renders the primary action as label + compact metadata inside the progress button.
- `DetailLineCard` no longer renders the old muted meta paragraph under the line title.
- Deleted the now-unused `readDetailLineMeta` UI helper and moved multiplier formatting into control.

Regression coverage:
- Control test verifies product/effect metadata labels.
- UI test verifies queue/duration appears once and after the primary action label, i.e. in the button instead of the original header slot.
