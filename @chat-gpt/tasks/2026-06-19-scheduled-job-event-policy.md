# Scheduled job/event policy audit

## Goal

Separate runtime time-flow concepts before changing code.

## Proposed primitives

- Job: planned activity. It can reschedule itself, hold progress/state, and eventually emit one or more events.
- Event: concrete occurrence due now. It is processed through the standard event pipeline and should not be used as a long-running activity.

## Questions to answer before refactor

- Which current scheduled records are real jobs?
- Which current scheduled records are due-now events?
- Which records exist only for visual sequencing and should not be persistent game truth?
- What is the retry/blocked policy for events that cannot be applied?
- What is the ordering/exclusive-key policy when multiple events are due at the same time?

## Guardrails

- Do not mix animation sequencing with persistent gameplay truth unless explicitly designed.
- Jobs may produce events, but events should stay small, concrete, and one-shot.
- Do not refactor the scheduled system until current usages are categorized.
