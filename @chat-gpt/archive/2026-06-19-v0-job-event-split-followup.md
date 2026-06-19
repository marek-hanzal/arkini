# V0 job/event split follow-up

Status: done on 2026-06-19.

Follow-up after the job/event migration.

## Checked

- Active `@chat-gpt` notes do not describe pending/scheduled events as a current primitive.
- Source code no longer exposes `scheduledEvents`, `ScheduledEvent`, or `pending event` naming for gameplay scheduling.
- Remaining `pending` wording in source is normal UI/storage pending state, not gameplay scheduling.
- Historical archive notes may still mention scheduled events because they explain old decisions and migrations.

## Active rule

- Scheduled/pending gameplay work is a job.
- `GameEvent` is only a now/output stream emitted by action/tick processing.
- Do not add a delayed event queue back into save state.
