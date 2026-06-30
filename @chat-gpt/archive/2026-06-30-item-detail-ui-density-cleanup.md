# Item detail UI density cleanup

Follow-up detail-sheet polish.

Changes made:
- Removed the hero-card storage placement pill (`both`/`board`/`inventory`) from item detail. Storage policy still exists in config/runtime; the detail hero just no longer spends prime UI space yelling it at the player.
- Removed duplicate count pills from Provided Effects and Product Lines headers, plus the tab count suffixes in those panels.
- Product/craft required resource rows now hide once the line/craft is ready to start or already running. Partially collected inputs still render so the player can see what is missing and withdraw before completion.
- Added regression coverage for hero badge removal, count-badge removal, producer ready-input hiding, and craft ready/running input hiding.

Validation:
- Targeted item-detail UI tests were run during implementation.
