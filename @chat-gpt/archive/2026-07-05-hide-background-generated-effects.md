# 2026-07-05 — hide background generated effects

- filtered item detail generated effects before they reach the runtime item catalog view
- hidden ownership/background grants such as `effect:grant-owned:*` / `grant:owned:*`
- kept player-facing item grant sources, e.g. path lock choices, visible in the Effects panel
- active/effect producer lines are still shown through the Lines UI, so useful grant sources are not lost
- added catalog regression tests for hidden owned grants and visible player-facing grants
