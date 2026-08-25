import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ChatGptSurfaceSchema } from "../../contract/chatgpt/ChatGptSurfaceSchema";
import { ElectronMainRuntime } from "../ElectronMainRuntime";
import type { TrustedRenderer } from "../security/TrustedRenderer";
import type { ChatGptViewControllerOwnership } from "./ChatGptViewControllerOwnership";
import { readChatGptViewControllerFx } from "./readChatGptViewControllerFx";

let registered = false;

/** Exposes only declarative surface placement to the trusted Arkini renderer. */
export const registerChatGptIpcFx = Effect.fn("registerChatGptIpcFx")(
	({
		ownership,
		trustedRenderer,
	}: {
		readonly ownership: ChatGptViewControllerOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}) =>
		Effect.sync(() => {
			if (registered) return;
			registered = true;
			ipcMain.handle(
				ArkiniElectronApi.channels.chatGptSurfaceSet,
				(event: IpcMainInvokeEvent, candidate: unknown) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer.assertTrustedIpcSenderFx(event).pipe(
							Effect.andThen(
								Effect.gen(function* () {
									const surface = yield* Effect.try({
										try: () => ChatGptSurfaceSchema.nullable().parse(candidate),
										catch: (cause) => cause,
									});
									const window = BrowserWindow.fromWebContents(event.sender);
									if (window === null)
										return yield* Effect.fail(
											new Error(
												"The trusted renderer has no owning BrowserWindow.",
											),
										);
									const controller = yield* readChatGptViewControllerFx({
										ownership,
										window,
									});
									yield* controller.setSurfaceFx(surface);
								}),
							),
						),
					),
			);
			app.once("will-quit", () => {
				ipcMain.removeHandler(ArkiniElectronApi.channels.chatGptSurfaceSet);
				registered = false;
			});
		}),
);
