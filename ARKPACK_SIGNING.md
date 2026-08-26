# Arkpack signing

Arkini has one signing identity per application build. `ARKINI_SIGN_KEY` contains standard
padded base64 of the complete Ed25519 PKCS8 PEM signing key. The build derives exactly one
base64 SPKI public key from it and embeds that public key into the application and CLI.
There is no key registry or key ID.

Changing `ARKINI_SIGN_KEY` creates a different Arkini distribution identity. Arkpacks signed
by another distribution are not official for the current build.

## Local development

Mise loads the ignored `.env.local` file. After installing repository dependencies, bootstrap
the first local key through the repository command surface:

```sh
./Argcfile.sh signing:keygen
./Argcfile.sh signing:keygen --force # explicit rotation
```

The file is written with mode `0600`; `--force` replaces only the `ARKINI_SIGN_KEY` assignment
and preserves unrelated dotenv values. The bootstrap runs the current source CLI because no
packaged `arkini-cli` can exist before the first successful build. Commands never print private
key material.

`arkini-cli game pack <project>` compiles the current portable project and atomically publishes:

```text
<project>/build/<encoded projectId>.arkpack
<project>/build/<encoded projectId>.arksig  # only when signed
```

An unsigned rebuild removes the previous signature because the complete `build/` directory is
replaced. Editor projects keep `/build/` in their `.gitignore`; exports and version snapshots do
not include build output.

The Editor Build page reports whether `ARKINI_SIGN_KEY` is configured, but never exposes its
value to the renderer. Leaving the field empty uses that main-process default; a pasted base64
key overrides it for one build and must match the public key embedded in that Arkini distribution.
The Editor does not persist pasted keys. Build, install, and download re-read the exact current
filesystem artifact and reject changed revisions, hashes, signing state, or invalid signatures.

## CI and releases

GitHub Actions stores the production value as the `ARKINI_SIGN_KEY` repository secret. The
workflow passes it unchanged to the application build and the standard `game pack` command.
Both therefore share one identity and signed builds fail when the key is missing or post-sign
verification fails.

Set or rotate the secret without printing it:

```sh
mise exec -- sh -c 'printf %s "$ARKINI_SIGN_KEY" | gh secret set ARKINI_SIGN_KEY'
```

Rotation means rebuilding and redistributing both Arkini and its Arkpack; old
signatures are intentionally not trusted by the new build.

## CLI

```sh
arkini-cli arkpack keygen
arkini-cli game pack game/arkini
arkini-cli arkpack sign path/to/game.arkpack
arkini-cli arkpack verify path/to/game.arkpack
```

`sign` uses `ARKINI_SIGN_KEY`. `verify` uses the public key embedded in the CLI build, with an
explicit `--public-key` available for inspecting another distribution. Trust is one of:

- `official`: the detached signature matches the embedded public key and exact Arkpack bytes;
- `external / unsigned`: no detached signature was provided;
- `invalid`: signature metadata is malformed or its cryptographic verification fails.
