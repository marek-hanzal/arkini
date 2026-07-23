# Frozen historical-migration guardrails

This file is temporary migration evidence, not an active protocol or task.

Current work is owned by [#263](https://github.com/marek-hanzal/arkini/issues/263), [#264](https://github.com/marek-hanzal/arkini/issues/264), and [#265](https://github.com/marek-hanzal/arkini/issues/265).

Until the historical tree is retired:

- never port a historical directory one-to-one;
- never claim a feature exists because its schema validates;
- consult historical source only for player-visible behavior, UX, copy, edge cases, animation or audio intent, or useful test scenarios explicitly named by a current GitHub issue;
- treat current runtime, session, Tick, placement, input, queue, compiler, save, bridge, and UI ownership as canonical unless a reproduced defect proves otherwise;
- put accepted behavior in active source, tests, and the owning root document;
- use Git history for completed plans and archaeology.

Delete this file with the remaining temporary `tasks/` surface after #265 and the final #266 reconciliation.
