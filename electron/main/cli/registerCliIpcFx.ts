import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "../ElectronMainRuntime";
import type { TrustedRenderer } from "../security/TrustedRenderer";
import type { Completion } from "./createCompletionFx";
import type { Installation } from "./createInstallationFx";

let registered = false;

/** Registers CLI filesystem capabilities behind the trusted renderer boundary. */
export const registerCliIpcFx = Effect.fn("registerCliIpcFx")(
	({
		completion,
		installation,
		trustedRenderer,
	}: {
		readonly completion: Completion;
		readonly installation: Installation;
		readonly trustedRenderer: TrustedRenderer;
	}) =>
		Effect.sync(() => {
			if (registered) return;
			registered = true;
			const runAuthorized = <Value, Error>(
				event: IpcMainInvokeEvent,
				operation: Effect.Effect<Value, Error, never>,
			) =>
				ElectronMainRuntime.runPromise(
					trustedRenderer.assertTrustedIpcSenderFx(event).pipe(Effect.andThen(operation)),
				);
			const handlers = [
				[
					ArkiniElectronApi.channels.cliStatus,
					(event: IpcMainInvokeEvent) => runAuthorized(event, installation.readStatusFx),
				],
				[
					ArkiniElectronApi.channels.cliInstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, installation.installFx),
				],
				[
					ArkiniElectronApi.channels.cliReplace,
					(event: IpcMainInvokeEvent) => runAuthorized(event, installation.replaceFx),
				],
				[
					ArkiniElectronApi.channels.cliUninstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, installation.uninstallFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionStatus,
					(event: IpcMainInvokeEvent) => runAuthorized(event, completion.readStatusFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionInstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, completion.installFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionReplace,
					(event: IpcMainInvokeEvent) => runAuthorized(event, completion.replaceFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionUninstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, completion.uninstallFx),
				],
			] as const;
			for (const [channel, handler] of handlers) ipcMain.handle(channel, handler);
			app.once("will-quit", () => {
				for (const [channel] of handlers) ipcMain.removeHandler(channel);
				registered = false;
			});
		}),
);
