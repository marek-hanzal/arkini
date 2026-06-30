# Item detail heading and requirement polish

Follow-up UI pass for item detail density/readability.

Changes made:
- `DetailCard` now renders only the small pink eyebrow when both `eyebrow` and `title` are provided. This removes duplicate white section titles like `LINES / Product Lines`, `EFFECTS / Provided effects`, and `CRAFT / <result>` while preserving plain titles on cards that do not have an eyebrow.
- Product-line effect requirement notes now render before outputs and material input rows, so missing effects/blockers are surfaced before the player scans resources.
- Raw item ids inside effect requirement labels are translated through the item catalog for readable UI labels, e.g. `Nearby producer:quarry-t1` becomes `Nearby Quarry I`.
- Product-line separator spacing increased from `gap-3` to `gap-[0.9rem]` while keeping the single flat separator model.
- Added regression coverage for collapsed double headers, readable requirement labels/order, and wider separator spacing.

Validation:
- Targeted item-detail UI tests were run during implementation.
