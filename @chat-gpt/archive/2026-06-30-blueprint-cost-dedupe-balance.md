# 2026-06-30 Blueprint cost dedupe balance

## What changed

- Smoothed repetitive blueprint/product-line cost loops where the product that creates a blueprint and the blueprint craft recipe asked for the same item again.
- Blueprint-producing product lines now behave as lighter plan/research/survey acquisition steps.
- Actual construction resources, permits, guild charters, construction bundles, labor food, morale, and prestige sinks stay in the blueprint craft recipe where they read as real build costs.
- The Town Hall IV chain no longer burns Feast during plan generation and then asks for Feast again during construction; plan acquisition now asks for a single Food Supply, while the craft keeps Feast as worker/labor cost.
- Late path keystone treasure cost was moved from plan acquisition into actual construction so `item:treasure-chest` remains a useful sink without double-taxing the plan step.

## Guardrail

Added a default config regression test that scans every blueprint-output product line with a matching craft recipe and rejects repeated input item ids across planning and construction.
