# 03 — Stash lifecycle

**Status:** Done

## Goal

Complete stash output and owner consumption without introducing stash-specific runtime state or completion machinery.

## Final design

The task exposed duplicated authoring and lifecycle semantics across producer, craft, blueprint, and stash. The final implementation normalizes the whole line-owner family:

- all item kinds retain their separate item schemas;
- every line uses the same `LineSchema` and `InputMaterialSchema`;
- every line may omit `line.output`;
- producer, craft, blueprint, and stash output exists only on `line.output`;
- every resolved drop preserves its authored placement;
- every line-owning item explicitly declares `afterCompletion: "keep" | "remove"`;
- one generic completion lifecycle replaces item-type completion dispatch.

The old `BlueprintItemSchema.targetId`, top-level blueprint output, top-level stash output, craft-only line/input schemas, and four completion branches were removed.

## Completion contract

```text
resolve ready job and deterministic optional line.output
→ detach completed job and job reservations in the candidate
→ apply drops in authored order with authored placement
→ keep or remove owner according to afterCompletion
→ for removed owners, discard queue and return buffered inputs
→ return job reservations last
→ validate and commit atomically
```

For a remove owner without a resolved replacement, the owner identity is removed before ordinary output placement so its board cell becomes available. If a replace drop resolves, standard replace placement removes the old identity. Output always claims capacity before buffered inputs and reservations return.

A keep owner retains identity, buffered inputs, and queue. Game validation rejects any keep line that can resolve a replace drop.

## Shared authoring and validation

- Positive material capacity remains part of the shared schema.
- Game validation permits positive capacity only on producer lines; craft, blueprint, and stash lines must use zero.
- Game validation rejects any possible resolved output with more than one replace drop.
- Blueprint assets use the standard explicit asset contract and are never inferred from output.
- A blueprint may replace itself, drop arbitrary or random output, or produce nothing.

## `maxCount`

Every line start reserves worst-case future output generically from `line.output`. No blueprint or stash-specific reservation branch remains. For `afterCompletion: "remove"`, output of the owner's own canonical item reserves only the net future increase after the live owner quantity disappears.

## Verification

Permanent tests cover:

- guaranteed and chance stash output;
- owner consumption exactly once;
- blocked output rollback and deterministic retry;
- active stash state round-trip;
- one-use producer through `afterCompletion: "remove"`;
- persistent craft through `afterCompletion: "keep"`;
- removing blueprint with no output;
- self-replacement against singleton `maxCount`;
- positive producer capacity and rejected positive craft/blueprint/stash capacity;
- keep plus replace rejection;
- multiple replace cardinality through the existing output validator;
- existing craft and blueprint completion, queue, reservation, and max-count flows through the generic lifecycle.

## Historical cleanup

Current runtime behavior supersedes `src/v0/stash`. The old directory remains physically coupled to the historical v0 action dispatcher, so it is marked archive-ready for the final v0 prune rather than being partially amputated here. Product copy, animation, and audio references remain assigned to tasks 13–15.
