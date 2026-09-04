import { BrowserWindow, ipcMain, Menu, screen } from "electron";
import { fileURLToPath } from "node:url";
import { Effect, Exit } from "effect";
import { ArkiniWindowTitle } from "~shared/ArkiniAppMetadata";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";
import { ElectronMainError } from "./ElectronMainError";
import { registerControlledWindowCloseFx } from "./registerControlledWindowCloseFx";
import type { TrustedRenderer } from "./security/TrustedRenderer";
import { createWindowModeControllerFx } from "./window/createWindowModeControllerFx";
import { calculateInitialWindowBoundsFn } from "./window/fn/calculateInitialWindowBoundsFn";
import type { WindowModeControllerOwnership } from "./window/createWindowModeControllerOwnershipFx";
import type { WindowPreferences } from "./window/createFilesystemWindowPreferencesFx";
import type { WindowModeSchema } from "../contract/window/WindowModeSchema";
import { createChatGptViewControllerFx } from "./chatgpt/createChatGptViewControllerFx";
import type { ChatGptViewControllerOwnership } from "./chatgpt/createChatGptViewControllerOwnershipFx";
import type { EditorMcpNgrokDomainSchema } from "~/authoring-mcp/schema/EditorMcpNgrokDomainSchema";

export namespace createMainWindowFx {
	export interface Props {
		readonly chatGptViewControllerOwnership: ChatGptViewControllerOwnership;
		readonly readMcpNgrokDomainFx: Effect.Effect<
			EditorMcpNgrokDomainSchema.Type | undefined,
			unknown,
			never
		>;
		readonly trustedRenderer: TrustedRenderer;
		readonly windowMode: WindowModeSchema.Type;
		readonly windowModeControllerOwnership: WindowModeControllerOwnership;
		readonly windowPreferences: WindowPreferences;
	}
}

export const createMainWindowFx = Effect.fn("createMainWindowFx")(
	({
		chatGptViewControllerOwnership,
		readMcpNgrokDomainFx,
		trustedRenderer,
		windowMode,
		windowModeControllerOwnership,
		windowPreferences,
	}: createMainWindowFx.Props) =>
		Effect.gen(function* () {
			const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
			const bounds = calculateInitialWindowBoundsFn(display.workArea);
			Menu.setApplicationMenu(null);
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

			const onReadyToShowFn = () => {
				window.show();
				window.webContents.send(ArkiniElectronApi.channels.windowVisible);
			};

			return yield* Effect.gen(function* () {
				yield* trustedRenderer.registerWindowFx(window);
				const chatGptViewController = yield* createChatGptViewControllerFx({
					readMcpNgrokDomainFx,
					window,
				});
				yield* chatGptViewControllerOwnership.attachControllerFx(
					window,
					chatGptViewController,
				);
				if (windowMode === "bordered") {
					yield* Effect.sync(() => window.maximize());
				}
				const windowModeController = yield* createWindowModeControllerFx({
					initialMode: windowMode,
					window,
					windowPreferences,
				});
				yield* windowModeControllerOwnership.attachControllerFx(
					window,
					windowModeController,
				);
				yield* registerControlledWindowCloseFx({
					window,
					ipc: ipcMain,
					trustedRenderer,
				});
				window.once("ready-to-show", onReadyToShowFn);

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
								window.removeListener("ready-to-show", onReadyToShowFn);
								if (!window.isDestroyed()) window.destroy();
							}),
				),
			);
		}),
);
