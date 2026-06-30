# Building maxCount pass

Gameplay config pass for board capacity and blueprint/craft waste prevention.

Changes made:
- Every producer item now has an explicit `maxCount`, so all craft/blueprint producer outputs inherit a target cap instead of letting players make a stupid pile of unusable building plans.
- Single-copy civic/progression institutions use `maxCount: 1` and an informational `unique` tag: Town Halls, Libraries, School/Academy/University, Civic Office, Markets, Prospector Guilds, Construction Yard, Heroes Guild, Shrine, and the three Choose-the-Path keystones.
- Ordinary production buildings get practical caps by role: core early producers are higher, houses have a wider morale cap curve, and specialized industry/guild buildings mostly sit at two copies.
- Added regression coverage that every authored producer item is capped and every single-copy producer carries `unique` metadata.

Validation target:
- `npm run game:validate -- game/arkini`
- `npm run test -- src/v0/game/compiled/defaultGameConfig.test.ts`
