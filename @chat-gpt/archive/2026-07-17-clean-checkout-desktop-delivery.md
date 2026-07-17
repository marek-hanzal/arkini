# Clean-checkout desktop delivery

GitHub follow-up review task: #241 under #236.

- The ignored official Arkpack is an active Vite asset import, so Dependency Cruiser cannot run before the pack exists in a fresh checkout.
- `npm run check` now runs type/schema gates, the production build, Dependency Cruiser, and permanent shards in that order. The build creates the official Arkpack once before dependency analysis consumes it.
- The macOS prerelease workflow runs format/type/source validation, the canonical `package:mac` command once, then Dependency Cruiser and permanent shards against those exact generated inputs.
- Packaging still owns one clean → pack/build → stage → electron-builder → streamed checksums → structure verification sequence. No hidden npm pre-hook or generic runner returned.
- `DesktopCleanCheckoutDelivery.test.ts` copies all tracked files into a temporary workspace without ignored outputs, links the installed dependencies, runs the canonical game pack command, and proves Dependency Cruiser succeeds against the generated asset.
- Literal package/workflow orchestration assertions were removed. The remaining builder-config source test is intentionally deferred to #240's whole-tree source-text cleanup.
