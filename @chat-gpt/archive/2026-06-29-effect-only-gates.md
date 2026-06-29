# 2026-06-29 — Effect-only gates

Goal: remove the old requirement subsystem entirely. No top-level `requirements`, no product `requirementIds`, no craft `requirements`. Ambient/world gates resolve through effects; physical activation materials remain `inputs`.

## Completed follow-up

Old requirement vocabulary and runtime state were removed. Ambient/world gates now resolve through Effect grants (`grant.add` + `grantSelector`), while physical materials remain activation `inputs`. Product lines, craft recipes, item creation, local proximity access, and owned-item era gates all go through the Effect subsystem rather than a parallel gate implementation.
