# macOS packaged preview

- Issue #245 adds the stable developer alias `npm run preview:macos`, backed by the canonical Effect CLI command `arkini desktop preview-macos`.
- Every production desktop build explicitly runs `packOfficialGameFx` before `buildDesktopOutputFx`; fresh checkouts never require an ignored Arkpack from an earlier run.
- Local preview owns clean → one pack/build → stage → one `electron-builder --dir` arm64 operation → print exact `release/mac-arm64/Arkini.app` path → launch that exact app with macOS `open`.
- Preview produces no DMG, ZIP, checksums, release assets, signing, or notarization.
- Release packaging reuses the same one-time build stage and retains streamed checksums and structure verification.
- Behavior tests cover build ordering, preview failure short-circuiting, exact app-path forwarding, unpacked builder arguments, CLI discovery, and clean-checkout build generation.
