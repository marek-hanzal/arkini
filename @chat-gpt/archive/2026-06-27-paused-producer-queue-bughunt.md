# Paused producer queue bughunt

Status: DONE
Date: 2026-06-27

## Finding

A producer job paused by unmet runtime requirements did not act as a hard queue barrier when the player started another product line that did not share the paused job's missing requirement.

That made a reachable invalid state possible:

1. Start product A with a product-level proximity requirement.
2. Move the required source out of range, pausing product A.
3. Start product B on the same producer because product B has no such requirement.

The second job started immediately even though the first job had no finite release time. Since the paused first job remains the queue head and has no wake time, the queued/running state could then become logically stuck or invalid. This violated the process-time model: a paused producer cannot continue working through later jobs.

## Fix

- Producer start readiness now rejects starting any new product line on a producer instance while any existing job in that producer queue is paused by unmet requirements.
- `GameSaveConfigSchema` now treats a paused producer job as having no finite queue barrier. Any later job behind a paused previous job is invalid save state.

## Coverage

Added expectation tests for:

- runtime rejection when starting another product behind a requirement-paused first job, even if the second product does not need the missing requirement
- save/config validation rejecting a producer queue job behind a paused previous job
