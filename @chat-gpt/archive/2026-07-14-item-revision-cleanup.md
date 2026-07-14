# Item revision cleanup

## Decision

- Keep `RuntimeItem.revision` as the optimistic stale-intent token for commands targeting a previously observed live item.
- Do not persist item revisions. Loading state is a hard session boundary and hydration assigns every runtime item a fresh revision.
- Remove revisions from active jobs and queued requests. No command compares a caller-observed job or queue revision.
- Tick updates `remainingMs` directly and does not generate opaque IDs on every fixed step.

## Resulting contract

```text
persisted gameplay state
→ hydrate canonical items
→ generate fresh item revisions
→ old UI intent is stale across load
```

Job IDs remain stable and persisted because deterministic completion randomness is seeded from job identity. Job revision never participated in that seed and no longer exists.

## Scope

This cleanup does not change item IDs, job IDs, queue request IDs, runtime atomicity, or item revision guards on move, swap, remove, quantity replacement, and material-source commands.
