# Broad runtime/UI pass

Status: DONE

Commit: broad runtime UI pass

## Fixed

- Craft blocked delivery now reaches runtime/UI views as `phase: "delivery_blocked"` with `deliveryBlocked: true`, not as a fake ready craft.
- Board tap behavior no longer treats blocked craft delivery as claimable completion.
- Stash activation now surfaces top-level `deliveryBlocked` using the shared producer delivery helper, matching producer activation and board highlight behavior.
- Producer jobs blocked at queued start time now pause from the current tick time when the start gate never opened, so progress stays frozen at zero instead of showing stale elapsed progress.

## Guardrail

Blocked delivery is retryable runtime state, not successful completion. UI should display it directly from runtime views and must not recreate progress/status locally.
