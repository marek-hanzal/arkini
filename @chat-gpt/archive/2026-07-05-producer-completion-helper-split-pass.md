# Producer completion helper split pass

Commit: 07f7c2ea

Goal: keep the post-scope cleanup moving into the next mental-load hotspot without changing producer runtime behavior.

Changes:
- Split producer completion event/result factories out of `completeProducerJobFx` into `ProducerJobCompletionEvents`.
- Split producer charge/depletion read + spend logic into `completeProducerJobChargesFx`.
- Kept `completeProducerJobFx` focused on completion orchestration: live job lookup, line/output read, placement, retry/block/fail routing, queue reschedule, and final result assembly.

Rationale:
`completeProducerJobFx` was no longer hiding props in local Context, but it still mixed completion orchestration, event constructors, charge accounting, depletion removal, and placement/retry logic. The extracted helpers reduce the file's mental load while preserving the same runtime paths and boundary helpers for job/charge/board writes.
