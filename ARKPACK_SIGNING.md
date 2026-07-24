# Arkpack signing

Arkpack signing proves that exact package bytes were signed by a key whose public half ships with Arkini. It is an authorship signal, not encryption, DRM, account identity, copy protection, or a claim that external content is unsafe.

## Contract

Arkini uses Ed25519 because verification needs only a public key in the client. HMAC would put a shared signing secret into every installation and would therefore provide no meaningful official-author distinction.

The signature is detached from the package:

```text
example.game.arkpack
example.game.arkpack.sig
```

The strict version-one JSON sidecar is:

```json
{
	"formatVersion": 1,
	"algorithm": "ed25519",
	"keyId": "arkini-official-2026-01",
	"contentHash": "<64 lowercase SHA-256 hex characters>",
	"signature": "<standard padded base64 Ed25519 signature>"
}
```

The signed payload is the exact byte concatenation:

```text
UTF-8("arkini:arkpack:v1\0") || exact final .arkpack bytes
```

There is no JSON canonicalization and no decode/re-encode step. SHA-256 is the package identity and a useful mismatch diagnostic; the Ed25519 signature is the authorship proof.

## Trust states

- `official` means the signature is structurally valid, its hash claim matches the exact bytes, its `keyId` exists in the explicit registry, and Ed25519 verification succeeds.
- `external / unsigned` means no sidecar was supplied. The package may still be decoded and played.
- `external / unknown-key` means a well-formed signature names a key outside the official registry. It is not silently promoted to official.
- `invalid` means the supplied sidecar is malformed, claims the wrong content hash, or fails cryptographic verification. Invalid is never downgraded to unsigned.

The generic byte loader accepts unsigned external content and returns this explicit trust union. A caller expecting bundled official content supplies the expected `keyId`; that path fails before package decompression when official verification is not established.

The current file-picker import stores a selected `.arkpack` without discovering a neighboring sidecar, so it deliberately enters as unsigned external content. The loader contract already accepts optional detached signature metadata for callers that own both files.

## Maintainer workflow

Generate a local Ed25519 key pair:

```bash
npm run arkpack:keygen
```

The command creates:

```text
.arkini/arkpack-private.pem
.arkini/arkpack-public.pem
```

`.arkini/` is the sole repository-local private-key convention and is ignored as a directory. The private file is written with mode `0600`. Key generation refuses to overwrite either requested output unless `--force` is explicit. Private key bytes are never printed.

There is no `.env.local` signing path. Local commands read `.arkini/arkpack-private.pem`; CI supplies the PEM directly through `ARKINI_ARKPACK_PRIVATE_KEY`.

Pack an ordinary unsigned authoring package:

```bash
npm run game:pack
```

Sign an existing final package:

```bash
npm run arkpack:sign -- \
	game/arkini.game.arkpack \
	--key-id arkini-official-2026-01
```

Verify a package and its canonical sidecar:

```bash
npm run arkpack:verify -- \
	game/arkini.game.arkpack \
	--trusted-keys game/arkini.arkpack.keys.json
```

Verification prints the content hash and explicit trust JSON. It exits non-zero for malformed, hash-mismatched, or cryptographically invalid signatures. Unsigned and unknown-key packages remain successful explicit external results.

Build, sign, and post-verify the official package in one operation:

```bash
npm run game:pack:official
```

The command fails closed when the private key is absent, the selected `keyId` is absent from the committed registry, or post-sign verification does not establish official trust.

The deliberately unsigned [`game/demo`](game/demo) package contains only one directional merge. `npm run game:pack:demo` includes it in application builds without a sidecar, proving that bundled location and official authorship are separate concepts.

## GitHub Actions

The macOS prerelease workflow reads the production private PEM from the repository secret `ARKINI_ARKPACK_PRIVATE_KEY`. Set or rotate it without printing the value:

```bash
gh secret set ARKINI_ARKPACK_PRIVATE_KEY < .arkini/arkpack-private.pem
```

Only [`game/arkini.arkpack.keys.json`](game/arkini.arkpack.keys.json), containing public material, is committed. The workflow builds the final official package, signs it, post-verifies it, and bundles the `.arkpack` and `.sig` through Vite. It never writes the secret into the repository.

## Rotation

1. Generate a new key pair and choose a new rotation-specific `keyId`.
2. Add the new public key to the registry while retaining the old public key.
3. Release an application version that trusts both identities.
4. Replace the CI secret and start signing new packages with the new private key.
5. Retain old public keys while older official packages or saves may still need verification.
6. Remove or mark a compromised identity only through a deliberate application update.

There is no network revocation, automatic expiry, remote PKI, Workshop identity, or third-party author certificate model in this milestone.
