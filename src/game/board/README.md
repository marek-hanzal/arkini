# board engine

The board engine is the command-facing boundary for board mutations.

Responsibilities:
- move board items between cells,
- swap occupied board cells,
- commit board merges through the existing transactional board Effect layer.

Non-responsibilities:
- do not resolve drag/drop intent,
- do not decide merge eligibility; use the merge engine before committing,
- do not render board UI or manage animation state.
