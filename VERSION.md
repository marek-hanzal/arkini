# Arkini versioning contract

This document defines the product compatibility promise carried by an Arkini
release version `<major>.<minor>.<patch>`.

## Compatibility

### Major

A major release may be incompatible with data written by an earlier major
release. This includes gameplay saves, Arkpacks, Editor projects, scenarios,
version history, and every other persisted Arkini-owned format.

Arkini may provide a migration, but a major release does not promise one. The
application owns that decision for each major transition.

### Minor

A minor release must not break any data supported by the previous release,
including gameplay saves, Arkpacks, Editor projects, scenarios, and version
history.

A minor release may change a persisted format and may include a migration, but
the application must prove that the upgrade is safe. A migration is optional;
data compatibility is not.

### Patch

A patch release contains fixes and other changes without material gameplay,
architecture, or data-contract impact. It inherits the minor-release
compatibility guarantee.

## Pre-stable development

Until the product owner explicitly declares the stable compatibility baseline,
Arkini moves forward without backward-compatibility or migration obligations.
Pre-stable data may be rejected after any change, and no legacy reader,
migration, compatibility fixture, or compatibility abstraction should be added
unless explicitly requested.

Public communication and user expectations for discarded pre-stable data are a
product-owner responsibility, not a reason to preserve obsolete code paths.

The first explicitly declared stable release establishes the baseline. The
major/minor/patch promises above apply to that release and the supported data it
creates, not retroactively to earlier development snapshots.

## Version authorities

The Arkini release version is the public compatibility promise. Project-owned
gameplay versions may provide more specific runtime provenance, but they cannot
weaken it: a minor Arkini release must not ship a gameplay or format change that
breaks data from the preceding supported release.

[DATA_CONTRACTS.md](DATA_CONTRACTS.md) inventories the current external file
shapes and field ownership. It does not override this release policy.
