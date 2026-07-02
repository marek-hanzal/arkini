# Embedded item capability hardening

## Scope

Production-grade cleanup after embedding producer/stash/craft/merge capabilities into item definitions.

## Done

- Removed remaining production references to old global product/producers/stashes/craft/merge registries and product-id terminology.
- Renamed producer runtime/save/action concepts from product-oriented names to line-oriented names.
- Replaced `productId`, `defaultProductId`, `defaultEffectProductId`, and `productInputs` save/action fields with `lineId`, `defaultLineId`, `defaultEffectLineId`, and `lineInputs`.
- Replaced producer events with line-oriented names: `producer_line.started`, `producer_line.completed`, `producer_line.blocked`, `producer_line.failed`, and `producer.line.default_changed`.
- Removed the global by-line-id runtime lookup helper. Producer line resolution now happens through the owning item capability whenever the producer item is known.
- Renamed runtime UI view payload from `productLines` to `producerLines` so board/detail components consume line-oriented activation metadata.
- Kept `lineKind: "product" | "effect"` because it is still a real UI grouping: a normal output line versus an active-effect line.

## Validation

- `rg` check over `src`, `cli`, `game`, and root docs for old product-id registry terms returns no production hits.
- Full project checks passed after the cleanup.
