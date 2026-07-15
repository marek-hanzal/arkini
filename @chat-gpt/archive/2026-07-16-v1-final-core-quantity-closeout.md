# v1 final core quantity closeout

## Scope

Closed the final core deep-review P2 in `setItemQuantityFx` before Task 10 read models.

## Confirmed bug

`setItemQuantityFx` treated its desired absolute quantity as a new additive drop during `maxCount` validation. The existing target quantity was therefore counted once as live state and again as the requested replacement.

## Implemented contract

`setItemQuantityFx` remains an absolute replacement command:

```text
other live canonical quantities
+ active-job reserved output quantities
+ desired replacement quantity
<= maxCount
```

For the maxCount calculation only, the command supplies `assertPlacementMaxCountFx` with a runtime snapshot excluding the target identity. The final revised candidate still passes the canonical runtime invariant checker through `modifyRuntimeFx`.

No placement options bag, replacement-specific placement mode, or item-type branch was introduced.

Setting the same quantity remains a successful write that produces a fresh item revision.

## Permanent coverage

`test/runtime/write/setItemQuantityMaxCount.test.ts` proves:

- increase from `1` to `maxCount` succeeds;
- setting the same quantity at `maxCount` succeeds and revises the item;
- decrease from `maxCount` succeeds;
- another live stack remains counted;
- active-job output reservation remains counted;
- true maxCount overflow fails atomically;
- failed replacement preserves the exact runtime and publishes no event.

Existing permanent tests continue to cover impure-item and job/reserved-scope rejection.

## Continuation

The final core review is closed. Continue with Task 10 engine-owned read models. Do not reopen stable placement, maxCount, job reservation, or runtime mutation architecture without concrete feature pressure.
