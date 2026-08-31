import { app, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { Effect } from "effect";
import { match } from "ts-pattern";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { EditorMcpCommandSchema } from "~electron/contract/editor/EditorMcpCommandSchema";
import { EditorMcpConfigurationSchema } from "~electron/contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpProjectContextSchema } from "~electron/contract/editor/EditorMcpProjectContextSchema";
import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import type { ServerOwnership } from "../http/createEditorMcpOwnershipFx";
import { requestVersionCheckoutFx } from "./requestVersionCheckoutFx";

let registered = false;

const watchedProjectContextSenders = new WeakSet<WebContents>();

export namespace registerEditorMcpPreferencesIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: ServerOwnership;
	}
}

/** Registers global MCP lifecycle/configuration independently from project persistence. */
export const registerEditorMcpPreferencesIpcFx = Effect.fn("registerEditorMcpPreferencesIpcFx")(
	({ trustedRenderer, ownership }: registerEditorMcpPreferencesIpcFx.Props) =>
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
			const watchProjectContextSender = (sender: WebContents) => {
				if (watchedProjectContextSenders.has(sender)) return;
				watchedProjectContextSenders.add(sender);
				sender.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
					if (isMainFrame && !isInPlace) ownership.resetProjectContext();
				});
				sender.once("destroyed", ownership.resetProjectContext);
			};
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpOverviewRead, (event) =>
				runAuthorized(event, ownership.readOverviewFx),
			);
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpConfigure, (event, candidate) =>
				runAuthorized(
					event,
					Effect.try({
						try: () => EditorMcpConfigurationSchema.parse(candidate),
						catch: (cause) => cause,
					}).pipe(Effect.flatMap(ownership.configureFx)),
				),
			);
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpCommand, (event, candidate) =>
				runAuthorized(
					event,
					Effect.try({
						try: () => EditorMcpCommandSchema.parse(candidate),
						catch: (cause) => cause,
					}).pipe(
						Effect.flatMap((command) =>
							match(command)
								.with("start-local", () => ownership.startLocalFx)
								.with("stop-local", () => ownership.stopLocalFx)
								.with("start-remote", () => ownership.startRemoteFx)
								.with("stop-remote", () => ownership.stopRemoteFx)
								.with("reset-remote-auth", () => ownership.resetRemoteAuthFx)
								.exhaustive(),
						),
					),
				),
			);
			ipcMain.handle(
				ArkiniElectronApi.channels.editorMcpProjectContextSet,
				(event, candidate) =>
					runAuthorized(
						event,
						Effect.try({
							try: () => EditorMcpProjectContextSchema.parse(candidate),
							catch: (cause) => cause,
						}).pipe(
							Effect.tap((projectId) =>
								Effect.sync(() => {
									watchProjectContextSender(event.sender);
									ownership.setProjectContext(projectId, (versionId) =>
										requestVersionCheckoutFx(event.sender, {
											projectId,
											versionId,
										}),
									);
								}),
							),
							Effect.asVoid,
						),
					),
			);
			ipcMain.handle(
				ArkiniElectronApi.channels.editorMcpProjectContextClear,
				(event, candidate) =>
					runAuthorized(
						event,
						Effect.try({
							try: () => EditorMcpProjectContextSchema.parse(candidate),
							catch: (cause) => cause,
						}).pipe(
							Effect.tap((projectId) =>
								Effect.sync(() => ownership.clearProjectContext(projectId)),
							),
							Effect.asVoid,
						),
					),
			);
			app.once("will-quit", () => {
				for (const channel of [
					ArkiniElectronApi.channels.editorMcpOverviewRead,
					ArkiniElectronApi.channels.editorMcpConfigure,
					ArkiniElectronApi.channels.editorMcpCommand,
					ArkiniElectronApi.channels.editorMcpProjectContextSet,
					ArkiniElectronApi.channels.editorMcpProjectContextClear,
				]) {
					ipcMain.removeHandler(channel);
				}
				registered = false;
			});
		}),
);
