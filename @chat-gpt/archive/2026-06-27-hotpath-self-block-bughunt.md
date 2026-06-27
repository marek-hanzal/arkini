# 2026-06-27 Hotpath self-block bughunt

Follow-up bughunt after effect/proximity queue work.

Fixed reachable edge cases:

- Overdue queued producer starts now re-check start gates when the app wakes after the exact scheduled `startAtMs`. If the product line is blocked/hidden at the late wake time, the job pauses with its full duration remaining instead of pretending it started earlier.
- `item.blockCreate` checks can ignore consumed/replaced sources. Merge participants and craft replacement targets no longer block their own result through passive create-block effects.
- Merge now rejects replacing a target with preservable runtime state, such as stored craft inputs. Replacing such a target would silently delete invested items/state.
- Craft start now rejects targets that already have a producer job. Producer start now rejects targets that already have a craft job. This prevents mixed-capability tiles from deleting each other's jobs during later replacement/completion.

Validation at handoff:

- `npm run check` passed.
- Test suite: 65 files, 436 tests.
