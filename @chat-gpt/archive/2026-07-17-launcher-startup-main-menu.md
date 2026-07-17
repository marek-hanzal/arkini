# Launcher startup and semantic main menu

Issue #246 replaces the old root package selector with the out-of-game Arkini startup and menu flow.

## Route ownership

- `/` owns the one-renderer-session splash and transition.
- `/main-menu` owns Play, Arkpacks, Settings, About, and trusted native Exit.
- `/arkpacks` is the moved existing selector over the same root catalog.
- `/settings` owns the only System/Light/Dark control.
- `/about` is a standalone credits page.
- `/game/$packageId` remains the only live-game branch; `/dev/**` is unchanged.

## Startup ownership

One class-free `LauncherStartup` owner and one `ArkpackCatalog` are created at the renderer root. Bootstrap begins immediately beneath an approximately 500 ms pure-black visual hold and concurrently prepares persisted theme/accent, trusted preload readiness, the shared catalog, exactly one built-in package identity, and Hero readiness. Appearance may publish early; hard readiness publishes one complete result. Failure remains retryable on the same splash.

The Hero composition appears as one scene after the black hold. Automatic exit requires readiness and five seconds elapsed from startup. Escape is legal only after readiness and starts the same one-shot transition. Reduced motion removes animation delay but preserves lifecycle ordering. Completion is recorded once, so later `/` navigation redirects to `/main-menu` without replay.

TanStack Query owns only concrete native Exit mutation state. It does not own startup, catalog, package identity, route loading, or game state.

## Shutdown correction

The product meaning of in-game `Save and exit` is final save plus whole-application shutdown. Its complete mutation requests trusted native close; the registered `GameOwner.shutdownFx` before-close listener performs final save and either sends `closeReady` or rejects the same request for truthful retry. It does not navigate to `/main-menu` and does not use `releaseRouteGameFx`.

## Appearance

Theme and accent are separately validated and atomically persisted. Missing or malformed data resolves to dark and rose. The renderer applies both before the visible splash where practical; BrowserWindow and document startup backgrounds remain pure black.

`/settings` is the sole theme-control surface. One complete `setAppearanceThemeMutationOptions` contract owns its stable key, direct `writeAppearanceThemeFx` call, immediate renderer application, active-value no-op, rollback, retry policy, and error propagation; `useSetAppearanceThemeMutation` only consumes those options. `system` sets Electron `nativeTheme.themeSource` and later native theme updates synchronize window backgrounds and renderer color-scheme resolution. The old floating theme/accent selector is deleted rather than duplicated.

## Validation

- formatting: 1,239 files;
- source, test, and Electron typechecks;
- game validation;
- production Electron build from a freshly generated official Arkpack;
- Dependency Cruiser: 1,016 modules / 4,427 dependencies;
- executable clean-checkout desktop build;
- focused launcher, Settings, appearance, native-close, and game-menu behavior tests;
- all ten permanent shard contents passed across 209 test files; the shard-10 runner hang was closed by running the only unreported file, `LauncherRoutes.test.ts`, separately (4/4).
