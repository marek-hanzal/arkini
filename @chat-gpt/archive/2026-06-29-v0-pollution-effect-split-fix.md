# 2026-06-29 — Pollution effect split/fix

## Decision

Pollution slowdown effects must be authored as separate product-scoped passive local effects.
Do not combine unrelated targets, such as `productIds` for farms and `producerIds` for brewery, in one `duration.proximityPenalty` operation unless the intended semantics are strict AND matching.

## Why

Effect target matching is conjunctive across target dimensions. A target containing both `productIds` and `producerIds` matches only product lines that satisfy both. The old combined pollution effect therefore failed farm lines because it targeted farm product IDs while also requiring the brewery producer ID.

## Current content

`item:pollution` now emits separate passive effects for:

- cattle milk
- chicken eggs
- farm grain
- piglets
- sheep wool
- vegetables
- brewery products
- winery products

Nearby Farm I grain now shows a slowed runtime duration and starts with the effective duration instead of the debug base `1s`.
