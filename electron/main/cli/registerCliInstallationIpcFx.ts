import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "../ElectronMainRuntime";
import type { TrustedRenderer } from "../security/TrustedRenderer";
import type { CliCompletion } from "./CliCompletion";
import type { CliInstallation } from "./CliInstallation";

let registered = false;

/** Registers the CLI installation capability behind the trusted renderer boundary. */
export const registerCliInstallationIpcFx = Effect.fn("registerCliInstallationIpcFx")(
	({
		cliCompletion,
		cliInstallation,
		trustedRenderer,
	}: {
		readonly cliCompletion: CliCompletion;
		readonly cliInstallation: CliInstallation;
		readonly trustedRenderer: TrustedRenderer;
	}) =>
		Effect.sync(() => {
			if (registered) return;
			registered = true;
			const runAuthorized = <Value, Error>(
				event: IpcMainInvokeEvent,
				operation: Effect.Effect<Value, Error>,
			) =>
				ElectronMainRuntime.runPromise(
					trustedRenderer.assertTrustedIpcSenderFx(event).pipe(Effect.andThen(operation)),
				);
			const handlers = [
				[
					ArkiniElectronApi.channels.cliStatus,
					(event: IpcMainInvokeEvent) =>
						runAuthorized(event, cliInstallation.readStatusFx),
				],
				[
					ArkiniElectronApi.channels.cliInstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, cliInstallation.installFx),
				],
				[
					ArkiniElectronApi.channels.cliReplace,
					(event: IpcMainInvokeEvent) => runAuthorized(event, cliInstallation.replaceFx),
				],
				[
					ArkiniElectronApi.channels.cliUninstall,
					(event: IpcMainInvokeEvent) =>
						runAuthorized(event, cliInstallation.uninstallFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionStatus,
					(event: IpcMainInvokeEvent) => runAuthorized(event, cliCompletion.readStatusFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionInstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, cliCompletion.installFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionReplace,
					(event: IpcMainInvokeEvent) => runAuthorized(event, cliCompletion.replaceFx),
				],
				[
					ArkiniElectronApi.channels.cliCompletionUninstall,
					(event: IpcMainInvokeEvent) => runAuthorized(event, cliCompletion.uninstallFx),
				],
			] as const;
			for (const [channel, handler] of handlers) ipcMain.handle(channel, handler);
			app.once("will-quit", () => {
				for (const [channel] of handlers) ipcMain.removeHandler(channel);
				registered = false;
			});
		}),
);
