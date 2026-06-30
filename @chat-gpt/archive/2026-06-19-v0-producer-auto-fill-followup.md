# V0 producer auto-fill follow-up

- Added regression coverage for product start auto-fill when a product line is already partially filled. Runtime should only pull the missing quantity, then consume the full required stored input when the product starts.
- Locked producer input routing priority for drag/feed interactions: default product line first, then remaining enabled lines in configured order, skipping lines already at capacity.
- UI start button now distinguishes ready stored inputs (`Start`) from resource-available auto-fill (`Auto-fill & start`).
