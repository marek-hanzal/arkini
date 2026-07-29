import { BrowserWindow, ipcMain, screen } from "electron";
import { fileURLToPath } from "node:url";
import { Effect, Exit } from "effect";
import { ArkiniWindowTitle } from "../../shared/ArkiniAppMetadata";
import { calculateInitialWindowBoundsFx } from "./calculateInitialWindowBoundsFx";
import { ElectronMainError } from "./ElectronMainError";
import { registerControlledWindowCloseFx } from "./registerControlledWindowCloseFx";
import { showMainWindowFx } from "./showMainWindowFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import type { TrustedRenderer } from "./security/TrustedRenderer";
import { createWindowModeControllerFx } from "./window/createWindowModeControllerFx";
import { registerWindowModeControllerFx } from "./window/WindowModeControllerRegistry";
import type { WindowPreferences } from "./window/WindowPreferences";
import type { WindowModeSchema } from "../contract/window/WindowModeSchema";

export namespace createMainWindowFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly windowMode: WindowModeSchema.Type;
		readonly windowPreferences: WindowPreferences;
	}
}

export const createMainWindowFx = Effect.fn("createMainWindowFx")(
	({ trustedRenderer, windowMode, windowPreferences }: createMainWindowFx.Props) =>
		Effect.gen(function* () {
			const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
			const bounds = yield* calculateInitialWindowBoundsFx(display.workArea);
			const window = new BrowserWindow({
				...bounds,
				show: false,
				title: ArkiniWindowTitle,
				backgroundColor: "#000000",
				fullscreen: windowMode === "fullscreen",
				fullscreenable: true,
				webPreferences: {
					preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
					contextIsolation: true,
					nodeIntegration: false,
					sandbox: true,
					navigateOnDragDrop: false,
				},
			});

			const onReadyToShow = () => {
				ElectronMainRuntime.runSync(showMainWindowFx(window));
			};

			return yield* Effect.gen(function* () {
				yield* trustedRenderer.registerWindowFx(window);
				if (windowMode === "bordered") {
					yield* Effect.sync(() => window.maximize());
				}
				const windowModeController = yield* createWindowModeControllerFx({
					initialMode: windowMode,
					window,
					windowPreferences,
				});
				yield* registerWindowModeControllerFx({
					controller: windowModeController,
					window,
				});
				yield* registerControlledWindowCloseFx({
					window,
					ipc: ipcMain,
					trustedRenderer,
				});
				window.once("ready-to-show", onReadyToShow);

				yield* Effect.tryPromise({
					try: async () => {
						if (trustedRenderer.developmentRendererUrl !== undefined) {
							await window.loadURL(trustedRenderer.developmentRendererUrl);
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
			}).pipe(
				Effect.onExit((exit) =>
					Exit.isSuccess(exit)
						? Effect.void
						: Effect.sync(() => {
								window.removeListener("ready-to-show", onReadyToShow);
								if (!window.isDestroyed()) window.destroy();
							}),
				),
			);
		}),
);
