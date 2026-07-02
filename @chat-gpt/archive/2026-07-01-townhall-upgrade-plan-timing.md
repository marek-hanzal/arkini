# 2026-07-01 Town Hall upgrade plan timing

- Town Hall upgrade blueprint product lines are now milestone-length waits instead of ordinary blueprint clicks:
  - `line:townhall-t1:blueprint-townhall-t2`: 60s
  - `line:townhall-t2:blueprint-townhall-t3`: 90s
  - `line:townhall-t3:blueprint-townhall-t4`: 120s
- These three product lines are tagged `shrine:haste-target` and have the `Minor Haste` duration multiplier (`grant.duration.multiply`, `0.75`, `whenActive`) so time boosts have a clear use on era jumps.
- Construction craft durations for the resulting blueprint items were left unchanged for now; this pass only stretches the Town Hall's plan-generation step.
