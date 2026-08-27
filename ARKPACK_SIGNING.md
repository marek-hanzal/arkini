# Arkpack release trust

Arkini exposes one soft provenance decision:

- `Trusted` means the exact Arkpack bytes carry a valid Sigstore bundle created by the
  repository embedded in this app build, using `.github/workflows/macos-prerelease.yml` on a
  Git tag.
- `External` means Arkini could not prove that release identity. This includes local and Editor
  builds, missing or malformed bundles, changed bytes, and bundles from another repository or
  workflow.

Both states are always playable. Trust is independent of Arkpack schema, semantic validation,
version compatibility, package identity, and user overrides. It is a useful label, not an
anti-tampering or content-admission system.

## Release channel

There is exactly one release channel. A tagged `macos-prerelease.yml` run receives GitHub's
short-lived OIDC identity through `id-token: write`. The workflow maps its vendor context into the
generic `ARKINI_RELEASE_ISSUER` and `ARKINI_RELEASE_IDENTITY` build inputs, then sets
`ARKINI_RELEASE_SIGN=1`. The built CLI:

1. packs the official game normally;
2. asks Sigstore Fulcio for an ephemeral certificate;
3. records the signature in Rekor;
4. writes the returned JSON bundle beside the pack as `arkini.arksig`;
5. verifies the final pair against Arkini's embedded trust root and workflow identity before
   packaging continues.

There is no stored signing key, repository signing secret, local key generation, or developer
mode. Manual workflow runs do not set release signing and therefore produce External packs.
Local `argc build`, Editor Build, Save as, and Install also produce External packs.

`arkini-cli game pack` owns the complete publication flow and signs only when the release build
sets `ARKINI_RELEASE_SIGN=1`. `arkini-cli arkpack verify <file>` performs the same offline
Trusted/External classification as the application. There are deliberately no standalone signing
or key-generation commands.

## Offline verification

The game performs no network request while loading an Arkpack. Electron main reads the exact
`.arkpack` bytes and optional `.arksig` under the existing filesystem snapshot boundary, then
checks:

- the bundle signature and message digest;
- the Fulcio certificate chain and certificate-transparency proof;
- the Rekor transparency-log proof;
- the GitHub Actions issuer;
- the exact repository embedded in this Arkini build and its release workflow identity.

Any missing or failed proof becomes `External`; it never prevents gameplay. The renderer receives
the same bounded bytes plus the two-state trust verdict and continues with normal decode,
compatibility, and game validation.

The trusted Sigstore root is checked into
`src/engine/pack/trusted-root.json`, so an older app intentionally does not learn new roots over
the network. Refresh it for a future Arkini release with:

```sh
argc signing:update-trusted-root
```

That command obtains the current root through Sigstore TUF. Root rotation reaches players only
through an Arkini application update.

A fork uses the same single-channel design without inheriting upstream authority: its GitHub
workflow derives `ARKINI_RELEASE_IDENTITY` from its own repository context. The fork therefore
trusts its own tagged workflow bundles, while upstream Arkini presents those same bundles as
External. Another CI vendor can reuse the issuer/SAN verifier, but still needs a release adapter
for obtaining its identity token and describing its certificate subject shape.

## Artifact layout

```text
<project>/build/<encoded projectId>.arkpack
<project>/build/<encoded projectId>.arksig  # release workflow only
```

The `.arksig` file contains the serialized Sigstore bundle for the exact sibling Arkpack bytes.
Every ordinary local rebuild atomically replaces `build/`, which also removes a stale release
bundle.
