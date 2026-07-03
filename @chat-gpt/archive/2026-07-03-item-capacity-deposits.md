# Item capacity deposits

Implemented finite item capacity for resource deposits.

- Items can define `capacity: { max, onDepleted }` with `remove`, `replace`, or `stop` depletion behavior.
- Capacity state is saved per item instance in `save.itemCapacities`.
- Capacity items must be `maxStackSize: 1`; partially depleted instances preserve state when stored.
- Producer lines can define root `nearby.capacity.spend` effects. The effect validates at job start, selects the nearest matching capacity source, and spends capacity immediately.
- Running producer jobs ignore capacity-spend requirements after start, so a job does not pause just because its source was spent on admission. Other live requirements and duration effects still evaluate normally.
- Default Arkini starts this on wood sources and stone deposits: lumberjack spends nearby `wood-source`, quarry spends nearby `item:rock`.
- UI exposes capacity as `remaining/max` on tiles and in detail hero cards.
