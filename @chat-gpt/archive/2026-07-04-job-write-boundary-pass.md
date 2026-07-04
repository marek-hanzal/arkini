# Job write boundary pass

Date: 2026-07-04
Commit: see git history

Goal: continue the deep cleanup after job removal and active-effect lifecycle boundaries by centralizing job map writes/updates.

Changes:
- Added `writeProducerJobToSaveFx`, `writeCraftJobToSaveFx`, and `writeItemSpawnJobToSaveFx`.
- Replaced raw production writes to `save.producerJobs[...]`, `save.craftJobs[...]`, and `save.itemSpawnJobs[...]` in producer start/completion/realtime/reschedule, craft start/completion/realtime, and item-spawn create/retry flows.
- Extended `audit:current` to reject production raw job-map writes outside the named write boundaries.

Rationale:
- Job lifecycle state is high-risk runtime data. Creation, retry, pause/resume, retime, and blocked delivery updates should stay grepable through named Fx boundaries instead of scattered map assignments.
- Tests may still build save fixtures directly; the audit excludes test files.
