# interaction engine

The interaction engine translates browser/UI gestures into game command plans.

Responsibilities:
- resolve drag/drop payloads into `DropPlan` values,
- choose the `GameCommand` that should be committed for accepted interactions,
- attach visual hints such as source hiding, flyer animation plans, and feedback callbacks.

Non-responsibilities:
- do not run database mutations directly; use the supplied command runner,
- do not own React state,
- do not duplicate merge eligibility; delegate that to the merge engine.
