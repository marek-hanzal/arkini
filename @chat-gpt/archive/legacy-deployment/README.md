# Archived deployment shell

These files belonged to the historical browser shell and static deployment pipeline.

They were removed from active repository configuration because they referenced a missing application entrypoint and an npm `build` script that does not exist in the current engine/tooling snapshot.

Do not restore them by default. A future renderer/deployment slice must introduce a fresh entrypoint, scripts, hosting policy, and workflow against the current architecture.
