# Serakki version and external data contract

This document owns release compatibility, persisted-envelope identity, and Serapack provenance. Exact structural schemas remain in source; filesystem publication mechanics live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Compatibility promise

An Serakki release is `<major>.<minor>.<patch>[-prerelease]`. The table is the durable promise for data at and after the product owner's explicitly declared stable baseline; the temporary pre-stable override below governs older development shapes.

| Change | Contract |
| --- | --- |
| Major | May break any earlier Serakki-owned data. Migration is an explicit product decision, never an implied promise. |
| Minor | Must preserve every supported Serapack, save, Editor project and other external contract from the previous release. A migration may implement compatibility, but is optional and must be proven safe. |
| Patch | Contains fixes without material gameplay, architecture, or data-contract impact and inherits the minor guarantee. |

Every persisted Serakki writer stamp records the complete release version, including prerelease provenance. Reader admission uses only its major:

- matching major is admitted regardless of minor/patch/prerelease ordering;
- mismatching major is rejected as incompatible;
- minor/patch must never select a parser, migration, fallback, or conditional data path;
- version admission never bypasses strict validation, semantic invariants, integrity, or provenance checks.

Reader compatibility and release provenance are independent. Reader admission compares only the major. Official provenance instead binds the signed payload to the distribution channel configured in the reading application; the writer's full version or release tag never changes trust and never selects a parser or rejects otherwise valid Community gameplay.

Project-owned gameplay version uses `<major>.<minor>[-suffix]` and is a separate authority chosen by the author at Build. A save and its Serapack are compatible when their gameplay majors match; minor and suffix cannot reject data or choose another reader. Writers stamp the complete string. The Editor stores the major, minor and optional suffix as output settings, with no effect on its live Board or authoring revision.

## Pre-stable policy

Until the product owner explicitly declares the stable shape baseline, Serakki may move persisted structures forward without migrations, legacy readers, obsolete-shape fixtures, or compatibility abstractions unless requested. This pre-stable exception overrides minor shape preservation: for example, a structurally obsolete file written by `0.5.0` may pass the `0.x` version gate but fail the current strict shape in `0.6.0`. Its version number still must not trigger a separate reader.

The first declared stable release establishes the durable baseline for data it supports. From that point, the minor guarantee applies to that baseline and later supported data; it is not retroactive to obsolete development shapes. Major-only version admission applies now. Public communication about discarded pre-stable data is a product decision, not a reason to preserve dead readers.

## Field ownership

Serakki release version is the only application-format version. Do not add `format`, `formatVersion`, namespaces, duplicated path identities, or fixed-value metadata. `$schema` and schema `$id` are links/identity for JSON Schema, not format versions.

Use the smallest non-derivable payload:

- a path owns filename/directory identity such as item UID/type, note ID, version ID, package/save namespace, and resource ID/kind;
- a payload owns domain data and provenance that cannot be reconstructed safely;
- a manifest stores lengths/hashes only where byte slicing or integrity requires them;
- an external field is valid only when its owner and a reader that cannot derive it are both clear.

## Portable project and sidecars

[`CONFIG.md`](CONFIG.md) owns the directory layout. External payload ownership is:

| File | Payload owner |
| --- | --- |
| `project.json` | `{ serakki, revision }`: writer provenance and current project revision. |
| `schema.json` | Current project JSON Schema with stable `$id` and explicit definitions. |
| `game.json` | `$schema`, structured output `version`, and complete non-item config; `meta.id` is package identity. |
| `items/<uid>.json` | `$schema` plus direct `item`; path owns UID, item owns gameplay ID. |
| `artwork/<id>.png`, `image/<id>.png`, `music/<id>.ogg`, `sfx/<id>.ogg` | Typed root owns semantic Resource type, filename owns ID, and extension owns encoding. |
| `music/<id>.json`, `sfx/<id>.json` | Editor-only `{ name }`; paired filename owns the same stable resource ID as the audio body. Portable project exports retain names; Serapacks omit them. |
| `notes/<noteId>.json` | Markdown content, optional unique immutable `itemUids` and canonical `resourceIds`, and ordering/freshness timestamps; path owns note ID. |

The Editor installation catalog stores discovery roots, managed/external ownership, and timestamps only. It never copies canonical project identity or mutable project fields.

## Installed save slots

Each game stores `current.serasave`, `manual.serasave`, `5-min.serasave`, `30-min.serasave`, and `4-hour.serasave` beneath `~/.serakki/game/saves/<encoded-package-id>/`. Each file uses the same save codec and compatibility checks. Filesystem modification time is the snapshot timestamp; it is set on the temporary file before atomic rename publishes bytes and timestamp together. No timestamp sidecar or save-format change is required.

Current follows autosave and final save. Each checkpoint initializes on the first current save and refreshes independently when its own real-time interval elapses, including after restart or a long gap. The interval is not a promise of exact snapshot age. Manual save only replaces its own slot. Restoring validated bytes replaces Current without rotating checkpoints. One package lock serializes reads, writes, restore, and deletion. Each replacement is atomic individually; a later checkpoint failure does not roll back earlier successful slots, and failed slots remain due for retry. Reset deletes the complete game save directory. Editor Board sessions remain ephemeral.

## Built and runtime artifacts

| Artifact | Contract |
| --- | --- |
| `.serapack` | Self-contained `SERAPACK` magic/length envelope around one streamable payload and optional Sigstore proof through EOF. The payload is a length-prefixed JSON manifest, JSON GameConfig, and ordered raw resource bodies. The proof signs only the exact payload. Manifest owns the formatted output `version` string, Serakki writer, source project revision, config byte length, and resource IDs/semantic types/lengths needed to copy resource ranges without materializing the package. Package ID comes only from `config.meta.id`. |
| Editor build descriptor | `{ projectId, revision, version, contentHash, size, diagnostics }`; disposable proof of one Community build with the exact output version, invalidated by later authored-content changes. `contentHash` covers only the inner gameplay payload. |
| `.serasave` | UTF-8 JSON `{ version, serakki, state }` below the collision-safe encoded package directory. Path owns package identity; payload owns gameplay compatibility, writer provenance, and complete State. |
| Latest incident environment | Disposable fixed directory `game/incidents/latest/` containing exact `game.serapack` and `save.serasave` replay inputs plus linked `incident.md`, `failure.md`, `history.md`, and `runtime-state.md` text reports. A later fatal failure hard-overwrites these files; modification time identifies freshness. The report is a debugging projection, not a versioned interchange format; each Serapack/save retains its own normal compatibility contract. |
| Diagnostics support ZIP | User-selected disposable archive containing the application version, coarse operating-system/display facts, the already support-safe bounded diagnostic logs, the actual last played installed-game provenance, and every save slot with its timestamp when that game was Official. The sink retains project-owned application/Editor lifecycle events and structured Official gameplay sessions while discarding arbitrary application detail plus Community and Editor Board session records at write time. Project identities, credentials, local paths, and all Serapack bytes are excluded. The ZIP is a support projection, not a replay or persistence format. |

Preferences are individual strictly validated scalar JSON files and need no envelope. Application runtime and fatal diagnostics are bounded rotating Markdown for direct human or LLM inspection; every record identifies the application through the root `package.json` version and marks any truncation. The private gameplay session stream remains library-owned JSONL because the session slicer consumes its structure. OAuth records use the protocol's fields; Serakki validates complete identities but adds no format marker. Public MCP and generated JSON schemas use stable explicit IDs so references are never anonymous or `any`.

## Release commits

`main` is Serakki's only long-lived branch and represents the current development snapshot. A release version tag identifies one concrete `main` commit. A bad release is fixed on `main` and followed by a new release; existing tags are not moved and user data is not downgraded.

## Serapack provenance

Provenance is soft and independent from schema, semantic validation, integrity admission, compatibility, package identity, location, and user overrides:

- `Official`: the embedded Sigstore proof offline-validates the current Serapack content hash for the configured distribution channel: its issuer and exact repository workflow identity.
- `Community`: that proof is absent or fails—for local/Editor/manual builds, changed payload bytes, malformed proof, or another issuer/repository/workflow channel.

Both states are playable. Provenance is a label, not an anti-tampering or content-admission system. A structurally invalid payload still fails normal loading; proof failure alone never does.

The one `.serapack` is the complete distributable artifact. Its proof is optional and signs the SHA-256 identity of the immutable payload, avoiding circular self-signing. Proof nondeterminism therefore cannot change gameplay identity or save association. Serapack readers follow the same forward-only major-version policy as the rest of the application; obsolete proof encodings are not retained.

Electron main hashes and validates the portable Serapack incrementally. First use copies its raw resource ranges into `game/installed/<encoded packageId>/<contentHash>/`; later loads trust and reuse a matching installation record without re-reading or tamper-checking the extracted bodies. Gameplay receives only validated config metadata and lazy same-origin `serakki://app/game/resource` URLs, never Serapack bytes. Native file responses preserve range requests for media seeking. Editor Serapack import uses the same extractor and copies those files into a new portable project; the renderer never receives the archive bytes.

The one tag workflow receives a short-lived OIDC identity, uses Sigstore Fulcio/Rekor transparency proofs, builds and signs the canonical Serapack once, and verifies it as Official before packaging. Prerelease tags first repeat the hosted branch gates: the complete repository gate on Linux and focused operating-system boundary gates on macOS and Windows. Stable tags deliberately skip checks. Both publish a GitHub Release; only prerelease tags mark it as a prerelease. Every platform receives and embeds the same final Serapack bytes, which are also published as the standalone Serapack. There is no stored signing key, signing secret, local key generation, developer mode, or standalone signing command. Local `argc build` and every Editor build remain Community.

Load and `serakki-cli serapack verify <file>` classify the single file offline while hashing and verifying its payload as a file stream. Verification checks payload digest/signature, Fulcio chain and certificate-transparency proof, Rekor proof, issuer, and exact repository workflow identity against the embedded [`src/serapack-artifact/constant/trusted-root.json`](src/serapack-artifact/constant/trusted-root.json). The certificate's workflow ref and the application's version are not channel identity. Failure becomes Community, never a load rejection.

Refresh a future embedded root through the deliberate networked maintenance command:

```bash
argc signing:update-trusted-root
```

Root rotation reaches users only in an Serakki application update. A fork derives and embeds its own issuer/repository/workflow channel; every build configured for that channel accepts its valid proofs across release versions and does not inherit upstream trust.
