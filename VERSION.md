# Arkini versioning contract

This document defines the product compatibility promise carried by an Arkini
release version `<major>.<minor>.<patch>[-prerelease]`.

## Compatibility

### Major

A major release may be incompatible with data written by an earlier major
release. This includes gameplay saves, Arkpacks, Editor projects, scenarios,
version history, and every other persisted Arkini-owned format.

Arkini may provide a migration, but a major release does not promise one. The
application owns that decision for each major transition. A mismatching major
is the only version-level reason for a reader to reject persisted data.

### Minor

A minor release must not break any data supported by the previous release,
including gameplay saves, Arkpacks, Editor projects, scenarios, and version
history.

A minor release may change a persisted format and may include a migration, but
the application must prove that the upgrade is safe. A migration is optional;
data compatibility is not. Readers must not reject data solely because its
minor version is older or newer than the current application or selected
Arkpack.

### Patch

A patch release contains fixes and other changes without material gameplay,
architecture, or data-contract impact. It inherits the minor-release
compatibility guarantee.

## Reader admission

Arkini release versions written into persisted data use
`<major>.<minor>.<patch>[-prerelease]`. The optional prerelease suffix is part
of complete writer provenance, but only the major is a reader-compatibility
gate:

- a matching major is admitted regardless of minor or patch ordering;
- a mismatching major is rejected as incompatible;
- minor and patch must not select a parser, migration, fallback, or conditional
  data path;
- admission never bypasses strict validation of the actual persisted shape or
  integrity checks.

This applies consistently to Arkpacks, gameplay saves, Editor projects,
scenarios, version history, and every other Arkini-owned persisted envelope.
Writers always stamp the current complete Arkini release version; readers do
not require that stamp to equal the running build.

Project-owned gameplay versions remain a separate domain authority. A save and
its Arkpack are version-compatible when their gameplay majors match. Gameplay
minor ordering must not reject a save or scenario and must not choose a
different reader implementation.

## Pre-stable development

Until the product owner explicitly declares the stable compatibility baseline,
Arkini moves forward without migration, legacy-reader, or conditional-reader
obligations. Pre-stable persisted shapes may still be replaced without a
migration, compatibility fixture, or compatibility abstraction unless
explicitly requested.

This freedom does not weaken reader admission. Structurally current data with a
matching major must not be rejected merely because it was stamped by a
different minor or patch release. Unsupported obsolete shapes may fail current
strict validation; their version number must not trigger a separate code path.

Public communication and user expectations for discarded pre-stable data are a
product-owner responsibility, not a reason to preserve obsolete code paths.

The first explicitly declared stable release establishes the durable shape
baseline. The no-data-break promise applies to that release and the supported
data it creates, not retroactively to obsolete development shapes. Major-only
reader admission applies now and does not wait for that declaration.

## Version authorities

The Arkini release version is the public compatibility promise. Project-owned
gameplay versions may provide more specific runtime provenance, but they cannot
weaken it: a minor Arkini release must not ship a gameplay or format change that
breaks data from the preceding supported release.

## Release commits

`main` is the only long-lived branch and always represents the current
development snapshot. A release version tag identifies the exact `main` commit
released under that version. If a release is bad, fix it on `main` and publish a
new release; do not move the existing tag or downgrade user data.

A stable Arkini release supports at least macOS and Windows. Each supported
operating system keeps its own packaging and delivery gate so one platform is
never treated as proof for another. Linux becomes a release target only after
its own delivery gate is implemented and proven.

[DATA_CONTRACTS.md](DATA_CONTRACTS.md) inventories the current external file
shapes and field ownership. It does not override this release policy.
