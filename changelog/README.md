# Arkini changelog

This directory is the canonical source of Arkini release notes. Each release
has one cumulative file named after its exact semantic version, for example
`0.6.0.md`.

The changelog does not depend on a release branch. The version file committed
to `main` describes the release, and its contents are used for the matching
GitHub Release.

## Starting a version

The target release version must be explicit in the task or release plan. Never
infer it from the highest existing filename or modify a released version merely
because no newer file exists. If the target version is ambiguous, stop and ask
the product owner.

1. Copy `TEMPLATE.md` to `<version>.md` when development of that version starts.
2. Replace the placeholder version and introduction with concrete release
   information.
3. Remove unused sections from the version file. Do not keep empty headings.
4. Never edit `TEMPLATE.md` merely to describe one release.

## Updating a version

Update the active version file in the same pull request whenever a change
materially affects:

- what players can do or observe;
- what game authors can create, configure, inspect, test, build, or publish;
- Arkpack, save, project, scenario, version-history, or other persisted-data
  compatibility;
- installation, distribution, recovery, trust, or another user-relevant
  lifecycle.

Do not add entries for internal refactors, test-only changes, dependency
housekeeping, presentation-only cleanup, or implementation details without a
user-visible consequence.

## Writing rules

- Write in English for players and game authors, not for the implementation
  team.
- Describe the shipped end state. Do not preserve superseded intermediate
  behavior or narrate how the implementation evolved.
- Organize entries by audience and capability instead of commit or pull-request
  order.
- Explain concrete behavior, constraints, and compatibility consequences. Do
  not paste commit titles or maintain a list of pull requests.
- Fold new information into the existing section and replace stale statements
  instead of appending contradictory bullets.
- Keep the document comprehensive but edited: combine closely related changes
  and omit implementation trivia.
- Keep reliability entries only when they describe a meaningful player,
  author, data-safety, or delivery consequence.
- Use exact Arkini domain names and controls where they help a player or author
  understand the feature.

## Releasing

Before tagging a release, review the complete version file against the shipped
tree, remove stale claims, and verify the compatibility notes against
`VERSION.md`. Publish the file contents as the matching GitHub Release notes.

After the release is tagged, treat its version file as historical release
documentation. Correct factual mistakes explicitly, but put subsequent product
changes into a new version file created from `TEMPLATE.md`.
