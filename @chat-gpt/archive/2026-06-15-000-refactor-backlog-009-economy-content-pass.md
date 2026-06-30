# Economy/content pass

Status: BLOCKED

## Goal

After the runtime is stable, revisit actual gameplay content and balance so Arkini feels like a small economy simulator rather than a random merge chain pile.

## Current direction

Deferred on purpose as of 2026-06-17. A large product change is expected next, so economy/content work should wait until that change lands to avoid designing against stale data and manufacturing conflicts for sport.


- Merge is only one basic mechanic.
- Producers/stashes/craft/upgrades are the long-term economy.
- Producers may require persistent workers/tools and consumable items such as beer/sausage.
- Higher-tier items may be better produced by buildings than hand-merged.

## Proposed work

- Review all merge chains for thematic sense.
- Review producer outputs and cooldowns.
- Add persistent requirements to selected producers, e.g. quarry requires worker.
- Add consumable inputs to selected producers, e.g. beer/sausage.
- Make automation choices meaningful: manual merge vs building production.
- Review upgrade costs as real inventory items.
- Ensure epic key/crate flow makes sense.

## Acceptance

- Content is data-driven in manifest config.
- No UI-specific content rules.
- Economy choices are simple and explainable.
- Typecheck and build pass.

## Watchouts

- Do not overdesign balance before runtime is stable.
- Do not create unrelated merge transformations without explicit fiction/mechanic.
