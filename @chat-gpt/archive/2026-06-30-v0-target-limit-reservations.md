# 2026-06-30 - v0 target limit reservations

Implemented target-limit reservations for producer outputs and craft starts.

- Product output target limits now optionally count pending craft source items (board + inventory), pending craft jobs, and pending producer jobs.
- Producer product starts/views enable those reservations, so blueprint products inherit the target building maxCount and cannot be spammed while an existing blueprint or queued output already reserves the target.
- Craft start constraints now use target-limit checks with pending job reservations instead of only raw board maxCount capacity.
- Craft views surface target limits with pending craft/producer jobs while ignoring the current craft target instance.
- Regression coverage added for board/inventory blueprints, queued producer reservations, and concurrent craft jobs reserving a maxCount result.
