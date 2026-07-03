# App splash hero as game asset

Status: completed 2026-07-03

- Splash screen uses `asset:game:hero` from the decoded game config, not an app-bundled image.
- `game/arkini/assets/hero.png` is packaged as resource `hero`; `game.json` points `asset:game:hero` at it.
- Compiler also synthesizes `asset:game:hero -> hero` when a source package has a `hero` PNG resource and no explicit override, so custom game config builds can brand the splash without touching app code.
- Audit treats well-known game assets as app-surface usage to avoid fake unused asset warnings.
