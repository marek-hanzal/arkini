# Gameplay reachability review: starting board to Goldsmith I

Date: 2026-06-22
Repo HEAD before review: `612fee2 Add pollution blockers to winery and brewery`
Scope: static gameplay-config audit only. No runtime/source gameplay code was changed.

## Result

The current Arkini config has a valid monotonic reachability path from the starting board to `producer:goldsmith-t1` and even to `item:coin`.

The static graph can reach all 77 configured items from the initial board if the player deliberately produces/builds the prerequisite chains before upgrading townhall tiers.

Important caveat: this is reachability, not soft-lock proof. Townhall upgrades consume the previous townhall tier. If a player upgrades before producing some tier-specific blueprints/source items, they can lose access to those products and lock themselves out of later branches.

## Verified starting anchors

Starting board contains:

- `item:tree`
- `producer:lumberjack-t1`
- `item:wheat-field`
- `producer:townhall-t1`
- `producer:well-t1`
- `item:rock`
- `producer:quarry-t1`

The initial proximity requirements are satisfiable on the starting board:

- `producer:lumberjack-t1` is near `item:tree`.
- `producer:quarry-t1` is near `item:rock`.
- `producer:well-t1` has no proximity requirement.
- `producer:townhall-t1` has no proximity requirement.

Because producer defaults are now explicit/noop by design, the path assumes the player starts product lines directly from the producer detail/product line UI, not by relying on board-click defaults.

## High-level golden path

### Tier 1 foundation

From the start:

- Lumberjack + tree produces `item:log`.
- Quarry + rock produces `item:stone`.
- Well produces `item:water`.
- Townhall I can produce early building blueprints using log/stone/water.

Buildable from Townhall I:

- `producer:sawmill-t1` from `item:blueprint-sawmill-t1` + log + stone.
- `producer:stonemason-t1` from `item:blueprint-stonemason-t1` + log + stone.
- `producer:farm-t1` from `item:blueprint-farm-t1` + log + water.

Then:

- Sawmill + log produces `item:plank`.
- Stonemason + stone produces `item:stone-block`.
- Farm + wheat-field + water produces `item:grain`.

Townhall II is reachable from Townhall I blueprint + Townhall I + plank + stone-block + grain.

### Food / drink economy

From Townhall II:

- Windmill blueprint is reachable via grain.
- Bakery blueprint is reachable via flour.
- Pig Farm blueprint is reachable via grain + water.
- Slaughterhouse blueprint is reachable via piglet.
- Hop Field is reachable via grain + water.
- Brewery blueprint is reachable via grain + water.
- Tavern blueprint is reachable via beer barrel.
- Vineyard is reachable via grain + water.
- Winery blueprint is reachable via grain + water.

Then:

- Windmill turns grain into flour.
- Bakery turns flour + water into bread.
- Pig Farm turns grain + water into piglet.
- Slaughterhouse turns piglet into sausage + leather.
- Brewery near Hop Field turns water into hops, then hops + water into beer barrel.
- Tavern turns beer barrel into beer.
- Winery near Vineyard turns water into grapes, grapes + water into wine barrel.
- Tavern turns wine barrel into wine glass.

Townhall III is reachable from Townhall II blueprint + Townhall II + plank + stone-block + bread + beer + sausage.

### Heavy industry

From Townhall III:

- Coal Deposit and Coal Mine blueprint are reachable via bread + water.
- Iron Deposit and Iron Mine blueprint are reachable via sausage + beer.
- Gold Deposit and Gold Mine blueprint are reachable via bread + wine glass.
- Smelter blueprint is reachable via coal + water.
- Purifier blueprint is reachable via pollution.
- Townhall IV blueprint is reachable via iron ingot + gold ingot.

Then:

- Coal Mine near Coal Deposit produces coal from bread + water.
- Iron Mine near Iron Deposit produces iron ore from sausage + beer.
- Gold Mine near Gold Deposit produces gold ore from bread + wine glass.
- Smelter turns iron ore + coal + water into iron ingot + pollution.
- Smelter turns gold ore + coal + water into gold ingot + pollution.
- Purifier is reachable from pollution + stone-block + iron-ingot + water.

Townhall IV is reachable from Townhall III blueprint + Townhall III + stone-block + iron ingot + gold ingot.

### Goldsmith

From Townhall IV:

- Goldsmith blueprint is reachable via gold ingot.
- Goldsmith I is reachable from Goldsmith blueprint + plank + stone-block + gold ingot + coal.
- Goldsmith can produce coins from gold ingot + wine glass + bread + coal.

## Static reachability result

The monotonic audit reached all configured item definitions: 77/77.

Every configured producer is reachable:

- `producer:lumberjack-t1`
- `producer:sawmill-t1`
- `producer:quarry-t1`
- `producer:stonemason-t1`
- `producer:well-t1`
- `producer:farm-t1`
- `producer:windmill-t1`
- `producer:bakery-t1`
- `producer:pig-farm-t1`
- `producer:slaughterhouse-t1`
- `producer:brewery-t1`
- `producer:tavern-t1`
- `producer:winery-t1`
- `producer:coal-mine-t1`
- `producer:iron-mine-t1`
- `producer:gold-mine-t1`
- `producer:smelter-t1`
- `producer:purifier-t1`
- `producer:goldsmith-t1`
- `producer:townhall-t1`
- `producer:townhall-t2`
- `producer:townhall-t3`
- `producer:townhall-t4`

No item is statically unreachable.

## Main gameplay holes / risks

### 1. Townhall upgrades can soft-lock progression

Townhall upgrade recipes currently consume the previous townhall tier:

- `craft:townhall-t2` consumes `producer:townhall-t1`.
- `craft:townhall-t3` consumes `producer:townhall-t2`.
- `craft:townhall-t4` consumes `producer:townhall-t3`.

That means each townhall tier is a one-way gate. This is fine only if the player has already produced every blueprint/source item they will ever need from the old tier.

The most dangerous lockout is Townhall II -> Townhall III:

- `producer:townhall-t2` is the only source of `item:vineyard` and `item:blueprint-winery-t1`.
- Wine is not needed to craft Townhall III.
- Wine glass is later needed for Gold Mine and Goldsmith economy.
- If the player upgrades to Townhall III before producing/building the wine branch, gold progression can be locked.

Another lockout is Townhall III -> Townhall IV:

- `producer:townhall-t3` is the only source of `item:blueprint-purifier-t1`.
- Purifier is not needed for Goldsmith, but it is needed if the promise is literally “build everything”.
- If the player upgrades before creating the purifier blueprint, purifier can be missed forever.

Mitigation options:

1. Higher townhall tiers inherit lower-tier product lines. This keeps townhall as one building and avoids irreversible product loss.
2. Townhall upgrade recipes use the previous townhall as a non-consuming input. This turns upgrades into building a new tier next to the old one.
3. Townhall upgrade recipes require all critical branch unlocks before allowing upgrade. This prevents early upgrade but can feel checklist-heavy.
4. Leave it as intentional one-way strategy, but then UI must warn hard before consuming a townhall tier.

Recommendation: option 1 is probably the cleanest for current Arkini. A Townhall II/III/IV should still know how to issue older civil blueprints unless we intentionally want tech-tier lockouts.

### 2. “No default product” is valid, but can feel dead without UI guidance

After the default-product cleanup, board-clicking a producer with no explicit default is a noop by design. This is correct, but the starting board has several no-default producers. If the product-line UI is not discoverable enough, the player may think producers are broken.

This is not a config reachability hole. It is a UX/tutorial risk.

Recommendation: for no-default producers, detail sheet should make product-line actions obvious. Do not add implicit defaults back. That demon was already exorcised.

### 3. Pollution is a slowdown, not a gate, so it does not break reachability

Current pollution blockers slow:

- `product:farm-t1:grain`, proximity 2.
- `product:pig-farm-t1:piglet`, proximity 2.
- `producer:brewery-t1`, proximity 2.
- `producer:winery-t1`, proximity 3.

Pollution appears late from smelting iron/gold. It does not block production, only slows duration, and can be moved/stored. Static reachability is therefore unaffected.

Potential tuning note: winery proximity 3 with durationFactor 0.5 is stronger than farm/pig/brewery and can reach a 2.5x slowdown at distance 1. That is probably fine if wine is intentionally sensitive to pollution.

### 4. Terminal items are expected, not broken

Validation currently warns that `item:coin` and `item:leather` are terminal. For this gameplay pass, that is acceptable:

- `item:coin` is the current late-game output.
- `item:leather` is a slaughterhouse byproduct with no sink yet.

If leather is supposed to matter soon, add a consumer later. It does not block the goldsmith chain.

## Suggested next config cleanup

- Decide townhall tier lockout policy before adding more mid/late branches.
- Add an automated reachability audit command that fails if key targets like `producer:goldsmith-t1` become unreachable from `startingState`.
- Optionally classify terminal outputs as intentional, so `coin` and `leather` do not keep warning forever once we know they are expected.

## Bottom line

Yes: with deliberate play, the current config can build everything from the starting board up to `producer:goldsmith-t1`, and can produce `item:coin` after that.

No: the current config is not soft-lock proof. The main hole is one-way townhall tier upgrades. If the player upgrades before generating some tier-specific branches, especially winery/vineyard before Townhall III, later progression can be cut off.
