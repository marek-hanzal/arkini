# V1 output runtime resolution

V1 now composes the configured output hierarchy through matching runtime Fx and result schemas:

- `RollSetSchema` -> `rollSetFx` -> `RollSetResultSchema`;
- `OutputSchema` -> `outputFx` -> `OutputResultSchema`;
- `selectRollSetFx` selects exactly one configured roll set by relative weight;
- omitted roll-set weights resolve as one;
- a single configured roll set is returned without consuming random input.

`RollSetResultSchema` intentionally contains unresolved `DropSchema` values aggregated from every roll in the selected set. `OutputResultSchema` contains resolved `DropResultSchema` values after drop availability and quantity resolution.

Rolls and drops are evaluated sequentially in authored order. Unselected roll sets are never evaluated, rejected drops remain discarded without replacement, and accepted sibling drops continue normally.

The output runtime stops before placement. The next layer may consume `OutputResultSchema` to place concrete drops according to each result's placement strategy.
