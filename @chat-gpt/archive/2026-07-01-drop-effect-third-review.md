# Drop effect third review

Another deep review after the drop-owned effect refactor.

Findings/fixes:

- Pending producer target-limit counts still read static `product.output`, so a queued/running job with a currently hidden or disabled drop could reserve max-count capacity for an item it could no longer deliver. Pending producer output reservation now evaluates the job's current effective loot plan and counts only currently enabled guaranteed base output.
- Runtime/UI target-limit checks now pass the relevant live clock (`nowMs` / scheduled `startAtMs`) into pending producer output reservation so active/expired grants are resolved the same way as product-line runtime views.
- Target-limited product lines no longer collapse their detail body. The UI still disables the primary action, but keeps target limits, outputs, drop effect explanations, inputs, and the default toggle visible so the line does not hide the exact reason and drop state the player needs to understand.

Tests added/updated:

- `readItemTargetLimits` covers pending producer jobs with drop-owned disabled output.
- `DetailProducerLinesPanel` now asserts target-limited lines keep outputs/limits/inputs/default controls visible.
