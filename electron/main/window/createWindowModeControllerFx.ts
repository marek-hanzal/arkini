import { screen, type BrowserWindow } from "electron";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import type { WindowModeSchema } from "../../contract/window/WindowModeSchema";
import { calculateInitialWindowBoundsFx } from "../calculateInitialWindowBoundsFx";
import { ElectronMainRuntime } from "../ElectronMainRuntime";
import type { WindowModeController } from "./WindowModeController";
import type { WindowPreferences } from "./WindowPreferences";

type WindowedMode = Exclude<WindowModeSchema.Type, "fullscreen">;

interface PendingRequest {
	readonly mode: WindowModeSchema.Type;
	readonly resolve: () => void;
	readonly reject: (cause: unknown) => void;
	readonly timeout: ReturnType<typeof setTimeout>;
}

const NATIVE_TRANSITION_TIMEOUT_MS = 5_000;

/** Creates the one native-mode lifecycle owner for a BrowserWindow. */
export const createWindowModeControllerFx = Effect.fn("createWindowModeControllerFx")(
	({
		initialMode,
		window,
		windowPreferences,
	}: {
		readonly initialMode: WindowModeSchema.Type;
		readonly window: BrowserWindow;
		readonly windowPreferences: WindowPreferences;
	}) =>
		Effect.sync(() => {
			let currentMode = initialMode;
			let previousWindowedMode: WindowedMode =
				initialMode === "fullscreen" ? "default" : initialMode;
			let pendingRequest: PendingRequest | undefined;
			let applyingWindowedMode = false;

			const applyWindowedMode = async (mode: WindowedMode) => {
				applyingWindowedMode = true;
				try {
					if (mode === "bordered") {
						window.maximize();
						return;
					}
					const display = screen.getDisplayMatching(window.getBounds());
					const { x, y, width, height } = ElectronMainRuntime.runSync(
						calculateInitialWindowBoundsFx(display.workArea),
					);
					window.unmaximize();
					await new Promise<void>((resolve) => setImmediate(resolve));
					window.setBounds({
						x,
						y,
						width,
						height,
					});
				} finally {
					applyingWindowedMode = false;
				}
			};

			const failPendingRequest = (cause: unknown) => {
				if (pendingRequest !== undefined) clearTimeout(pendingRequest.timeout);
				pendingRequest?.reject(cause);
				pendingRequest = undefined;
			};

			const settleMode = (mode: WindowModeSchema.Type) => {
				if (mode === "fullscreen") {
					if (currentMode !== "fullscreen") previousWindowedMode = currentMode;
				} else {
					previousWindowedMode = mode;
				}
				currentMode = mode;

				const request = pendingRequest?.mode === mode ? pendingRequest : undefined;
				if (pendingRequest !== undefined && request === undefined) {
					clearTimeout(pendingRequest.timeout);
					pendingRequest.reject(
						new Error(`Window mode request was superseded by ${mode}.`),
					);
				}
				if (request !== undefined) clearTimeout(request.timeout);
				pendingRequest = undefined;

				if (!window.webContents.isDestroyed()) {
					window.webContents.send(ArkiniElectronApi.channels.windowModeChanged, mode);
				}
				void ElectronMainRuntime.runPromise(windowPreferences.writeModeFx(mode))
					.then(() => request?.resolve())
					.catch((cause) => {
						if (request !== undefined) {
							request.reject(cause);
							return;
						}
						console.error("Arkini window mode could not be persisted.", cause);
					});
			};

			const requestMode = (mode: WindowModeSchema.Type) =>
				new Promise<void>((resolve, reject) => {
					failPendingRequest(new Error(`Window mode request was superseded by ${mode}.`));
					const timeout = setTimeout(() => {
						if (pendingRequest?.mode !== mode) return;
						failPendingRequest(
							new Error(`Electron did not confirm ${mode} mode in time.`),
						);
					}, NATIVE_TRANSITION_TIMEOUT_MS);
					pendingRequest = {
						mode,
						resolve,
						reject,
						timeout,
					};
					try {
						if (mode === "fullscreen") {
							if (currentMode !== "fullscreen") {
								previousWindowedMode = currentMode;
							}
							if (window.isFullScreen()) {
								settleMode("fullscreen");
								return;
							}
							window.setFullScreen(true);
							return;
						}
						if (window.isFullScreen()) {
							window.setFullScreen(false);
							return;
						}
						void applyWindowedMode(mode)
							.then(() => settleMode(mode))
							.catch(failPendingRequest);
					} catch (cause) {
						failPendingRequest(cause);
					}
				});

			window.on("enter-full-screen", () => settleMode("fullscreen"));
			window.on("leave-full-screen", () => {
				const mode =
					pendingRequest?.mode !== undefined && pendingRequest.mode !== "fullscreen"
						? pendingRequest.mode
						: previousWindowedMode;
				void applyWindowedMode(mode)
					.then(() => settleMode(mode))
					.catch(failPendingRequest);
			});
			window.on("maximize", () => {
				if (applyingWindowedMode || window.isFullScreen() || pendingRequest !== undefined) {
					return;
				}
				settleMode("bordered");
			});
			window.on("unmaximize", () => {
				if (applyingWindowedMode || window.isFullScreen() || pendingRequest !== undefined) {
					return;
				}
				settleMode("default");
			});
			window.once("closed", () => {
				failPendingRequest(
					new Error("The window closed before its mode transition completed."),
				);
			});
			window.webContents.on("before-input-event", (event, input) => {
				if (input.type !== "keyDown" || input.isAutoRepeat) return;
				const isFullscreenToggle =
					input.key === "F11" || (input.alt && input.key === "Enter");
				if (!isFullscreenToggle) return;
				event.preventDefault();
				void requestMode(
					currentMode === "fullscreen" ? previousWindowedMode : "fullscreen",
				).catch((cause) => {
					console.error("Arkini window mode shortcut failed.", cause);
				});
			});

			return {
				requestModeFx: (mode) =>
					Effect.tryPromise({
						try: () => requestMode(mode),
						catch: (cause) => cause,
					}),
			} satisfies WindowModeController;
		}),
);
