# Arkini version and external data contract

This document owns release compatibility, persisted-envelope identity, and Arkpack provenance. Exact structural schemas remain in source; filesystem publication mechanics live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Compatibility promise

An Arkini release is `<major>.<minor>.<patch>[-prerelease]`. The table is the durable promise for data at and after the product owner's explicitly declared stable baseline; the temporary pre-stable override below governs older development shapes.

| Change | Contract |
| --- | --- |
| Major | May break any earlier Arkini-owned data. Migration is an explicit product decision, never an implied promise. |
| Minor | Must preserve every supported Arkpack, save, Editor project, scenario, version history, and other external contract from the previous release. A migration may implement compatibility, but is optional and must be proven safe. |
| Patch | Contains fixes without material gameplay, architecture, or data-contract impact and inherits the minor guarantee. |

Every persisted Arkini writer stamp records the complete release version, including prerelease provenance. Reader admission uses only its major:

- matching major is admitted regardless of minor/patch/prerelease ordering;
- mismatching major is rejected as incompatible;
- minor/patch must never select a parser, migration, fallback, or conditional data path;
- version admission never bypasses strict validation, semantic invariants, integrity, or provenance checks.

Reader compatibility and release provenance deliberately use the version differently. Reader admission compares only the major, while an Official proof must bind the exact complete current build version, including prerelease suffix. Exact-version proof matching never selects a parser or rejects otherwise valid Community gameplay.

Project-owned gameplay version uses `<major>.<minor>` and is a separate authority. A save/scenario and its Arkpack are compatible when their gameplay majors match; minor ordering cannot reject data or choose another reader. Writers always stamp current complete provenance.

## Pre-stable policy

Until the product owner explicitly declares the stable shape baseline, Arkini may move persisted structures forward without migrations, legacy readers, obsolete-shape fixtures, or compatibility abstractions unless requested. This pre-stable exception overrides minor shape preservation: for example, a structurally obsolete file written by `0.5.0` may pass the `0.x` version gate but fail the current strict shape in `0.6.0`. Its version number still must not trigger a separate reader.

The first declared stable release establishes the durable baseline for data it supports. From that point, the minor guarantee applies to that baseline and later supported data; it is not retroactive to obsolete development shapes. Major-only version admission applies now. Public communication about discarded pre-stable data is a product decision, not a reason to preserve dead readers.

## Field ownership

Arkini release version is the only application-format version. Do not add `format`, `formatVersion`, namespaces, duplicated path identities, or fixed-value metadata. `$schema` and schema `$id` are links/identity for JSON Schema, not format versions.

Use the smallest non-derivable payload:

- a path owns filename/directory identity such as item UID/type, note ID, version ID, package/save namespace, and resource ID/kind;
- a payload owns domain data and provenance that cannot be reconstructed safely;
- a manifest stores lengths/hashes only where byte slicing or integrity requires them;
- an external field is valid only when its owner and a reader that cannot derive it are both clear.

## Portable project and sidecars

[`CONFIG.md`](CONFIG.md) owns the directory layout. External payload ownership is:

| File | Payload owner |
| --- | --- |
| `project.json` | `{ arkini, revision }`: writer provenance and current project revision. |
| `schema.json` | Current project JSON Schema with stable `$id` and explicit definitions. |
| `game.json` | `$schema`, gameplay `version`, and complete non-item config; `meta.id` is package identity. |
| `items/<type>/<uid>.json` | `$schema` plus direct `item`; path owns type/UID, item owns gameplay ID. |
| `assets/<id>.png`, `resources/<id>.png` | Path owns ID/kind; extension owns current MIME. |
| `notes/<noteId>.json` | Content and ordering timestamps; path owns note ID. |
| `scenarios/<hash>.json` | Human name, revision, gameplay version, State bytes, and timestamps; hash path is content-safe identity. |
| `versions/head.json` | Published current/list order. |
| `versions/<versionId>/version.json` | Parent, subject/body/tag, writer/gameplay provenance, source revision, fingerprint, time; directory owns ID. |
| `versions/<versionId>/manifest.json` | Hashes of the complete versioned project/scenario set. |

The Editor installation catalog stores discovery roots, managed/external ownership, and timestamps only. It never copies canonical project identity or mutable project fields.

## Built and runtime artifacts

| Artifact | Contract |
| --- | --- |
| `.arkpack` | Self-contained magic/length envelope around one gzip-compressed MessagePack gameplay payload and optional Sigstore proof through EOF. The proof signs only the exact compressed payload. Manifest owns gameplay `version`, Arkini writer, config byte length, and resource IDs/lengths needed to slice the stream. Package ID comes only from `config.meta.id`. |
| Editor build descriptor | `{ projectId, revision, contentHash, size, diagnostics }`; disposable proof of one Community build, invalidated by later project mutation. `contentHash` covers only the inner gameplay payload. |
| `.arksave` | MessagePack `{ version, arkini, state }` below the collision-safe encoded package directory. Path owns package identity; payload owns gameplay compatibility, writer provenance, and complete State. |

Preferences are individual strictly validated scalar JSON files and need no envelope. Diagnostics are library-owned JSONL. OAuth records use the protocol's fields; Arkini validates complete identities but adds no format marker. Public MCP and generated JSON schemas use stable explicit IDs so references are never anonymous or `any`.

## Release commits

`main` is Arkini's only long-lived branch and represents the current development snapshot. A release version tag identifies one concrete `main` commit. A bad release is fixed on `main` and followed by a new release; existing tags are not moved and user data is not downgraded.

## Arkpack provenance

Provenance is soft and independent from schema, semantic validation, integrity admission, compatibility, package identity, location, and user overrides:

- `Official`: the embedded Sigstore proof offline-validates the exact inner gameplay payload for the issuer, exact repository workflow, and exact full version embedded in this Arkini build.
- `Community`: that proof is absent or fails—for local/Editor/manual builds, changed payload bytes, malformed proof, another full version, or another repository/workflow.

Both states are playable. Provenance is a label, not an anti-tampering or content-admission system. A structurally invalid payload still fails normal loading; proof failure alone never does.

The one `.arkpack` is the complete distributable artifact. Its proof is optional and signs only the immutable inner payload, avoiding circular self-signing. Proof nondeterminism therefore cannot change gameplay identity or save association.

Tagged development and stable workflows receive a short-lived OIDC identity, use Sigstore Fulcio/Rekor transparency proofs, build and sign the canonical Arkpack once, and verify it as Official before packaging. Every platform receives and embeds those exact final bytes. There is no stored signing key, signing secret, local key generation, developer mode, or standalone signing command. Manual workflow, local `argc build`, and every Editor build remain Community.

Load and `arkini-cli arkpack verify <file>` classify the single file offline. Verification checks payload digest/signature, Fulcio chain and certificate-transparency proof, Rekor proof, issuer, exact repository workflow identity, and `refs/tags/v<full current version>` against the embedded [`src/engine/pack/trusted-root.json`](src/engine/pack/trusted-root.json). Failure becomes Community, never a load rejection.

Refresh a future embedded root through the deliberate networked maintenance command:

```bash
argc signing:update-trusted-root
```

Root rotation reaches users only in an Arkini application update. A fork derives and embeds its own repository/workflow authority; it does not inherit upstream trust.
