# Launcher and game-menu integration completion

Parent review #271 tracked three gaps from the launcher/game-menu snapshot. Development CSP #267 was already fixed and macOS-verified. This pass implements the remaining visual lifecycle children #247 and #272.

## Game menu

- `GameMenuProvider` owns `closed | entering | open | exiting` and one shared asynchronous close completion.
- WAAPI `Animation.finished` owns enter/exit settlement; no timeout duplicates the visual duration.
- Rapid Escape during enter exits from the current computed frame without a snap.
- Backdrop, focus trap, and action blocking remain authoritative until exit finishes.
- Save and exit keeps the scene fully open during `GameOwner.shutdownFx`; after final save succeeds, preload waits for the shared menu exit before sending Electron `closeReady`.
- Hard reset publishes the fresh same-package `Game` beneath the still-mounted menu and then fades out over it.
- A synchronous local action guard prevents same-tick duplicate mutations before TanStack pending reaches React.

## Startup splash

- Electron main sends one typed `windowVisible` signal immediately after `ready-to-show` calls `show()`.
- The renderer measures the approximately 500 ms pure-black hold from that actual visibility timestamp, not module import time.
- Persisted appearance is applied in layout, and `heroReady` becomes true only after `HTMLImageElement.decode()`.
- Visual readiness may reveal the Hero scene while catalog bootstrap continues truthfully; hard readiness still gates Escape and automatic exit.
- `/main-menu` is mounted beneath the splash, and WAAPI exit cross-fades directly into it.
- Completion, unmount, and navigation follow `Animation.finished`; route View Transitions are disabled for this internal hand-off to avoid a second snapshot transition.
- There is no reduced-motion branch by product decision.

## Validation before platform smoke

- format, source/test/Electron typechecks, game validation, production desktop build, and Dependency Cruiser passed;
- focused Electron, startup, game-menu, router, and hard-reset integration tests passed;
- native Electron visual smoke remains required because the retained Linux dependency tree has no Electron executable.
