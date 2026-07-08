# 2026-07-08 Config schema bootstrap

Started new authored config schema in `./config/schema`.

Notes:
- one schema per file
- file name matches exported schema name
- `IdSchema` is the only shared ID primitive
- this is shape work only; semantic validation is intentionally deferred to a separate service
- created as parallel rewrite track, without wiring into runtime/compiler yet
