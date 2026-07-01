# 2026-07-01 — Item detail UI truth/layout pass

## Scope
- Reworked item detail sheet layout away from heavy card shells toward section separators.
- Split generated effect presentation into polarity-specific sections (buff/debuff/neutral/mixed), omitting empty groups.
- Kept fulfilled craft/producer inputs visible until the job actually starts running, so withdraw affordances remain available while inputs are still stored.
- Aligned sheet header padding/width with the detail body.

## Key decisions
- Truth beats terseness: fulfilled inputs now remain visible in detail views until runtime consumes them.
- Effect polarity is conveyed by section placement, so the per-effect polarity tag was removed.
- `DetailCard` is now a lightweight section wrapper; large borders/shadows moved out in favor of top-level separators.

## Verification
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- --run --reporter=dot`
- `npm run build`
