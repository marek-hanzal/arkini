# 2026-06-30 Cheat speed mode

Implemented two storable cheat utility items:

- `item:cheat:speed-enable` / Open Onion Watch
- `item:cheat:speed-disable` / Closed Onion Watch

Both are normal catalog items with 128x128 transparent PNG assets under `game/arkini/assets` and `storage: "both"`, so they can be spawned through cheat inventory and stored like ordinary test tools.

Runtime additions:

- Added save-level optional `cheats.speedMode: "normal" | "instant"`.
- Added action `cheat.speed_mode.set`.
- Single-clicking the speed watch items on the board dispatches the action directly, no confirmation/sheet.
- Instant mode normalizes positive producer and craft durations to `1000ms`.
- Realtime sync respects the mode, including pulling queued producer jobs forward while instant mode is active.
- Switching back to normal restores authored durations for newly synced/newly started jobs.

Validation/test coverage:

- Board tap resolver tests prove the watch items toggle speed mode instead of opening detail.
- Engine tests cover instant producer starts, queued producer pull-forward, normal mode restore, and craft timing.

## Toggle-state polish

Follow-up changed the watches from two independent action items into one state-reflecting board utility:

- The closed watch (`item:cheat:speed-disable`) is now placed on the starting board and represents normal timing.
- Clicking the closed watch switches to instant mode and converts all speed-watch instances/stacks on the board and in inventory into the open watch (`item:cheat:speed-enable`).
- Clicking the open watch switches back to normal mode and converts all speed-watch instances/stacks back into the closed watch.
- Debug spawning a speed watch now spawns the item matching the current speed mode, so the save should not naturally contain both open and closed watch variants at once.
