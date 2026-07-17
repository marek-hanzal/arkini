import { BrowserWindow, ipcMain, screen } from "electron";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { calculateInitialWindowBoundsFx } from "./calculateInitialWindowBoundsFx";
import { ElectronMainError } from "./ElectronMainError";
import { registerControlledWindowCloseFx } from "./registerControlledWindowCloseFx";
import { registerFullscreenShortcutsFx } from "./registerFullscreenShortcutsFx";

export const createMainWindowFx = Effect.fn("createMainWindowFx")(() =>
	Effect.gen(function* () {
		const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
		const bounds = yield* calculateInitialWindowBoundsFx(display.workArea);
		const window = new BrowserWindow({
			...bounds,
			show: false,
			backgroundColor: "#0f172a",
			webPreferences: {
				preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
			},
		});

		yield* registerFullscreenShortcutsFx(window);
		yield* registerControlledWindowCloseFx({
			window,
			ipc: ipcMain,
		});
		window.webContents.setWindowOpenHandler(() => ({
			action: "deny",
		}));
		window.once("ready-to-show", () => window.show());

		yield* Effect.tryPromise({
			try: async () => {
				if (process.env.ELECTRON_RENDERER_URL) {
					await window.loadURL(process.env.ELECTRON_RENDERER_URL);
					window.webContents.openDevTools({
						mode: "detach",
					});
				} else {
					await window.loadURL("arkini://app/");
				}
			},
			catch: (cause) =>
				new ElectronMainError({
					operation: "load the Arkini renderer",
					cause,
				}),
		});
		return window;
	}),
);
