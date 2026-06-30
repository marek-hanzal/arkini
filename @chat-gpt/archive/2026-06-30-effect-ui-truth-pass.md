# Effect UI truth pass

## Summary

Reviewed the post-polarity effect UI plumbing after the line-owned effect refactor.

## Findings

- Product-line runtime views still allowed missing `lineKind`, and UI/logic had legacy `lineKind ?? "product"` fallbacks. Removed the fallback and made `lineKind` required in `ProducerProductLineViewSchema` so runtime must say whether a line is a normal product or an active effect line. Effect lines must expose `effectPolarity`; plain product lines must not, so UI grouping cannot silently normalize bad view data.
- Producer UI showed both product and effect defaults as the same generic `Default` badge/button label. Product and active-effect defaults are separate slots, so UI now labels `Default product` and `Default effect` explicitly.
- `grant.blockStart` requirement rows used the normal ready checkmark semantics when inactive. UI now says `Not blocked by ...` for inactive blockers and `Blocked ...` for active blockers.
- Renamed product-line view `effectRequirementsReady` to `startRequirementsReady`, matching producer/craft start-gate semantics after nearby requirements and blockers were folded into the same concept.

## Guardrails

Do not reintroduce `lineKind ?? "product"`. Missing runtime line kind should fail at the view schema/type boundary, not quietly become product UI. Missing effect-line polarity should fail validation instead of becoming neutral UI by accident.
