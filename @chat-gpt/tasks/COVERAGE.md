# Remaining historical-oracle ownership

This is a temporary deletion guard, not a capability matrix, roadmap, or status report. Active source, tests, root documentation, and GitHub Issues own current truth.

## Remaining explicit owners

| Historical evidence | Current owner | Allowed use |
| --- | --- | --- |
| `src/_archive/audio/**` | [#259](https://github.com/marek-hanzal/arkini/issues/259) | Sound policy, synthesis, batching, and event-to-audio intent only |
| Unclassified behavior or presentation evidence under `src/_archive/**` | [#263](https://github.com/marek-hanzal/arkini/issues/263) and [#264](https://github.com/marek-hanzal/arkini/issues/264) | Concrete parity proof against current source, tests, and root contracts |
| Final surviving historical source tree | [#265](https://github.com/marek-hanzal/arkini/issues/265) | Dependency-safe removal after the owning parity work is complete |

Item Detail behavior and its corrections are captured by completed [#343](https://github.com/marek-hanzal/arkini/issues/343) and [#344](https://github.com/marek-hanzal/arkini/issues/344). Do not resurrect the superseded #248–#253 plan tree.

## Guard

Do not browse the historical tree speculatively. A current GitHub issue must name a concrete missing behavior or historical area before it is consulted. Historical topology, save design, timestamp scheduling, action buses, runtime mirrors, compiler conventions, and UI-owned gameplay decisions remain rejected as architecture.

Once #265 removes `src/_archive`, delete this file and the remaining `tasks/` directory through #266. Git history retains the archaeology.
