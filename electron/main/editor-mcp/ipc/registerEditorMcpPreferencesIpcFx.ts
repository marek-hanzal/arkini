import { app, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";
import { EditorMcpPortSchema } from "../../../contract/editor/EditorMcpPortSchema";
import { EditorMcpProjectContextSchema } from "../../../contract/editor/EditorMcpProjectContextSchema";
import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import { checkEditorMcpPortAvailabilityFx } from "../http/checkEditorMcpPortAvailabilityFx";
import type { EditorMcpOwnership } from "../http/createEditorMcpOwnershipFx";
import type { EditorMcpPreferences } from "../preference/EditorMcpPreferences";
import { requestEditorMcpVersionCheckoutFx } from "./requestEditorMcpVersionCheckoutFx";

let registered = false;

const watchedProjectContextSenders = new WeakSet<WebContents>();

export namespace registerEditorMcpPreferencesIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly preferences: EditorMcpPreferences;
		readonly ownership: EditorMcpOwnership;
	}
}

/** Registers global MCP port settings independently from editor persistence. */
export const registerEditorMcpPreferencesIpcFx = Effect.fn("registerEditorMcpPreferencesIpcFx")(
	({ trustedRenderer, preferences, ownership }: registerEditorMcpPreferencesIpcFx.Props) =>
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
				sender.on("did-start-loading", ownership.resetProjectContext);
				sender.once("destroyed", ownership.resetProjectContext);
			};
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpPortRead, (event) =>
				runAuthorized(event, preferences.readPortFx),
			);
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpPortWrite, (event, candidate) =>
				runAuthorized(
					event,
					Effect.try({
						try: () => EditorMcpPortSchema.parse(candidate),
						catch: (cause) => cause,
					}).pipe(Effect.flatMap(preferences.writePortFx)),
				),
			);
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpPortCheck, (event, candidate) =>
				runAuthorized(
					event,
					Effect.gen(function* () {
						const port = EditorMcpPortSchema.safeParse(candidate);
						const status = ownership.readStatus();
						if (port.success && status.type === "ready" && status.port === port.data) {
							return {
								type: "active" as const,
							};
						}
						return yield* checkEditorMcpPortAvailabilityFx(candidate);
					}),
				),
			);
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpStatus, (event) =>
				runAuthorized(event, Effect.sync(ownership.readStatus)),
			);
			ipcMain.handle(ArkiniElectronApi.channels.editorMcpActivate, (event) =>
				runAuthorized(event, ownership.activateFx),
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
										requestEditorMcpVersionCheckoutFx(event.sender, {
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
					ArkiniElectronApi.channels.editorMcpPortRead,
					ArkiniElectronApi.channels.editorMcpPortWrite,
					ArkiniElectronApi.channels.editorMcpPortCheck,
					ArkiniElectronApi.channels.editorMcpStatus,
					ArkiniElectronApi.channels.editorMcpActivate,
					ArkiniElectronApi.channels.editorMcpProjectContextSet,
					ArkiniElectronApi.channels.editorMcpProjectContextClear,
				]) {
					ipcMain.removeHandler(channel);
				}
				registered = false;
			});
		}),
);
