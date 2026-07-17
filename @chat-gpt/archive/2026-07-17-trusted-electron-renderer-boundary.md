# Trusted Electron renderer boundary

GitHub review task: #237 under #236.

Implemented decisions:

- Electron authorizes one registered Arkini `BrowserWindow` through a shared trusted-renderer capability.
- Packaged URLs are restricted to the parsed `arkini://app` origin.
- Development URLs are restricted to the exact configured loopback Vite origin.
- External main-frame navigation and redirects are prevented; all subframe navigation, webviews, popups, and unused Chromium permissions are denied.
- Arkpack, save, appearance, and controlled-close IPC require the registered `webContents`, exact main frame, and a currently trusted frame URL.
- Packaged protocol responses include a restrictive CSP. Development uses the same policy plus only the fixed HMR WebSocket endpoint.
- Window teardown removes trusted-window/listener state and process shutdown removes global invoke handlers.

Do not weaken sender authorization to `webContents.id`, string-prefix URL matching, sandbox/context-isolation assumptions, or preload capability shape alone.

Validation at completion:

- format, source/test/Electron typechecks, Dependency Cruiser, game validation, and production Electron build passed;
- focused trusted-renderer, protocol, privileged IPC, and controlled-close tests passed;
- all ten canonical Vitest shards passed: 211 files / 661 tests.
