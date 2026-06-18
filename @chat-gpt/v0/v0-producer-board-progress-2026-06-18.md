# v0 producer board progress

Status: completed
Date: 2026-06-18

## What changed

Producer board tiles now show the currently running producer job with the existing subtle bottom progress bar.

Implementation notes:

- `readProducerBoardProgress` derives board-tile progress from producer product line view data.
- It only returns progress for a line whose `startedAtMs <= nowMs < readyAtMs`.
- Future queued jobs are ignored.
- Completed blocked deliveries are ignored; those are represented by the existing subtle danger frame via `activation.deliveryBlocked`.
- `BoardTile` keeps craft overlay progress and reuses `BoardCellCooldownProgress` for producer job/cooldown bottom-bar progress.

## Design rule

Board tile progress is for active work, not backlog or blocked delivery. A package stuck in the doorway should look blocked/danger, not like the producer is happily working.

## Follow-up

Next useful task candidate is tile-detail executable interaction parity: item detail must not promise merge/interactions that the runtime drop/action resolver cannot execute.
