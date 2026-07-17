# Game-wide button primitives

## Result

- Replaced the primary-only module with one `src/ui/button/Button.tsx` primitive family.
- `Button` / `ButtonLink` render neutral actions.
- `PrimaryButton` / `PrimaryButtonLink` render emphasized actions.
- `DangerButton` / `DangerButtonLink` render destructive actions.
- Native and router versions share the same internal role styling; router links use TanStack Router `createLink` and `LinkComponent` so `to`, `params`, `search`, preload, and registered-router inference remain intact.
- Internal class composition uses `tailwind-merge`, allowing callsites to change only layout or sizing without carrying duplicate interaction styling.
- Main menu, startup retry, Settings, About, Arkpacks, and the in-game menu now consume the shared family.
- Arkpack removal and game destruction use the destructive primitive; ordinary Exit remains a neutral action because it does not delete game data.

## Guardrail

Do not expose a public generic `variant` prop or rebuild page-specific button wrappers. Add another explicit role only after a repeated product meaning exists.
