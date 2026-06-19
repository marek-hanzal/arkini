# Add save/config version reset

Status: DONE

## Goal

Stop old incompatible saves from causing startup loops, broken migrations, or undead runtime states.

The game does not promise backwards compatibility for dev saves. If the game crashes from storage/runtime corruption, the first recovery action is full OPFS reset + reload, not a soft schema negotiation layer.

## Current state

- GAME.MD allows dropping incompatible saves after migrations.
- Root error boundary has a hard reset path for OPFS storage.
- Multiple structural migrations now exist: item instances, activation inputs, craft inputs.
- There is no final strict config/schema version gate yet.

## Completed work

- Rejected the soft save/schema version gate for this prototype phase.
- Root error boundary now starts full OPFS hard reset automatically on mount, then reloads.
- Database sheet hard reset uses the same OPFS reset path instead of SQLocal database-file deletion.
- Bootstrap no longer tries recoverable migration surgery; migration failure crashes upward and lets the root reset policy handle it.
- Removed the old database-file reset backend export and helper files.
- Documented the hard reset policy in README and GAME.MD.

## Acceptance

- A root runtime/database crash immediately starts full OPFS reset and reload.
- Manual database reset uses the same OPFS reset path.
- No soft save/schema compatibility layer was added.
- Typecheck and build pass.

## Watchouts

- Do not reintroduce database-file-only reset as the primary reset path.
- Do not add save/schema compatibility negotiations unless the product phase changes.
- OPFS hard reset is intentionally destructive; PNG/code assets are not touched because they are bundled files, not OPFS storage.
