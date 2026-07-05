# 2026-07-05 — target limit badge UI

- simplified detail target limit rendering from a full boxed panel into compact badges
- `maxCount === 1` now renders as `Unique` only, without repeating target item name/count
- multi-count limits render as a concise `Limit owned/max` badge
- exhausted limits retain warning styling without extra `Limit reached` copy
