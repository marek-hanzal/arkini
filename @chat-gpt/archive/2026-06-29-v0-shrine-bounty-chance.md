# Shrine bounty chance pass

- Replaced the shrine Bountiful Offering fixed `loot.quantity.add` effect with chance-based extra output so it no longer prints +1 on every run like a tiny balance crime.
- Added `loot.extraOutputChance.add`, which targets product lines and then filters the produced output item ids through an item selector before adding independent chance drops.
- Tagged early bounty outputs with item-level tiers: `tier-1-resource` for Log, Stone, Water, Grain, Vegetables and `tier-2-resource` for Plank.
- Authored Bountiful Offering as 35% chance for +1 matching tier-1 output and 30% chance for +1 matching tier-2 output.
- Effect benefit copy now describes chance-based extra output, so the shrine UI tells players the actual deal instead of selling a mystery loot coupon.
