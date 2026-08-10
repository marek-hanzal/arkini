import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import type { EditorProjectTransport } from "../../contract/editor/EditorProjectTransport";
import type { EditorProjectRepositoryService } from "../../../src/editor/EditorProjectRepository";
import type { EditorProjectRepositoryError } from "../../../src/editor/EditorProjectRepositoryError";
import type { EditorProjectServiceOwnership } from "../../../server/editor/EditorProjectServiceOwnership";
import {
	parseCreateProjectRequest,
	parseEditorProjectId,
	parseReplaceConfigRequest,
	parseReplaceResourceRequest,
	parseUpsertItemRequest,
	parseUpsertResourcesRequest,
} from "../../../server/editor/parseEditorProjectRequest";
import { ElectronMainRuntime } from "../ElectronMainRuntime";
import type { TrustedRenderer } from "../security/TrustedRenderer";

let registered = false;

const unavailable = (
	operation: EditorProjectTransport.Operation,
	message: string,
): EditorProjectTransport.Result<never> => ({
	type: "failure",
	error: {
		operation,
		message,
	},
});

const execute = <Value>(
	operation: EditorProjectTransport.Operation,
	ownership: EditorProjectServiceOwnership,
	run: (
		repository: EditorProjectRepositoryService,
	) => Effect.Effect<Value, EditorProjectRepositoryError>,
): Effect.Effect<EditorProjectTransport.Result<Value>> => {
	if (ownership.type === "unavailable") {
		return Effect.succeed(unavailable(operation, ownership.message));
	}
	return run(ownership.repository).pipe(
		Effect.match({
			onFailure: (error) => ({
				type: "failure" as const,
				error: {
					operation: error.operation,
					message: error.message,
				},
			}),
			onSuccess: (value) => ({
				type: "success" as const,
				value,
			}),
		}),
	);
};

export namespace registerEditorProjectIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: EditorProjectServiceOwnership;
	}
}

/** Registers editor-only IPC even when SQLite is unavailable. */
export const registerEditorProjectIpcFx = Effect.fn("registerEditorProjectIpcFx")(
	({ trustedRenderer, ownership }: registerEditorProjectIpcFx.Props) =>
		Effect.sync(() => {
			if (registered) return;
			registered = true;
			const runAuthorized = <Value>(
				event: IpcMainInvokeEvent,
				operation: Effect.Effect<Value>,
			) =>
				ElectronMainRuntime.runPromise(
					trustedRenderer.assertTrustedIpcSenderFx(event).pipe(Effect.andThen(operation)),
				);
			const handle = <Value>(
				channel: string,
				run: (event: IpcMainInvokeEvent, candidate: unknown) => Effect.Effect<Value>,
			) =>
				ipcMain.handle(channel, (event, candidate) =>
					runAuthorized(event, run(event, candidate)),
				);

			handle(ArkiniElectronApi.channels.editorStatus, () =>
				Effect.succeed(
					ownership.type === "ready"
						? ({
								type: "ready",
							} as const)
						: ({
								type: "unavailable",
								message: ownership.message,
							} as const),
				),
			);
			handle(ArkiniElectronApi.channels.editorAwaitIdle, () =>
				execute("await-idle", ownership, (repository) => repository.awaitIdleFx),
			);
			handle(ArkiniElectronApi.channels.editorProjectList, () =>
				execute("list-projects", ownership, (repository) => repository.listProjectsFx),
			);
			handle(ArkiniElectronApi.channels.editorProjectRead, (_event, candidate) =>
				execute("read-project", ownership, (repository) =>
					Effect.try({
						try: () => parseEditorProjectId(candidate),
						catch: (error) => error as EditorProjectRepositoryError,
					}).pipe(Effect.flatMap(repository.readProjectFx)),
				),
			);
			handle(ArkiniElectronApi.channels.editorProjectCreate, (_event, candidate) =>
				execute("create-project", ownership, (repository) =>
					Effect.try({
						try: () => parseCreateProjectRequest(candidate),
						catch: (error) => error as EditorProjectRepositoryError,
					}).pipe(Effect.flatMap(repository.createProjectFx)),
				),
			);
			handle(ArkiniElectronApi.channels.editorProjectReplaceConfig, (_event, candidate) =>
				execute("replace-config", ownership, (repository) =>
					Effect.try({
						try: () => parseReplaceConfigRequest(candidate),
						catch: (error) => error as EditorProjectRepositoryError,
					}).pipe(Effect.flatMap(repository.replaceConfigFx)),
				),
			);
			handle(ArkiniElectronApi.channels.editorProjectReplaceResource, (_event, candidate) =>
				execute("replace-resource", ownership, (repository) =>
					Effect.try({
						try: () => parseReplaceResourceRequest(candidate),
						catch: (error) => error as EditorProjectRepositoryError,
					}).pipe(Effect.flatMap(repository.replaceResourceFx)),
				),
			);
			handle(ArkiniElectronApi.channels.editorProjectUpsertItem, (_event, candidate) =>
				execute("upsert-item", ownership, (repository) =>
					Effect.try({
						try: () => parseUpsertItemRequest(candidate),
						catch: (error) => error as EditorProjectRepositoryError,
					}).pipe(Effect.flatMap(repository.upsertItemFx)),
				),
			);
			handle(ArkiniElectronApi.channels.editorProjectUpsertResources, (_event, candidate) =>
				execute("upsert-resource", ownership, (repository) =>
					Effect.try({
						try: () => parseUpsertResourcesRequest(candidate),
						catch: (error) => error as EditorProjectRepositoryError,
					}).pipe(Effect.flatMap(repository.upsertResourcesFx)),
				),
			);

			const channels = [
				ArkiniElectronApi.channels.editorStatus,
				ArkiniElectronApi.channels.editorAwaitIdle,
				ArkiniElectronApi.channels.editorProjectCreate,
				ArkiniElectronApi.channels.editorProjectList,
				ArkiniElectronApi.channels.editorProjectRead,
				ArkiniElectronApi.channels.editorProjectReplaceConfig,
				ArkiniElectronApi.channels.editorProjectReplaceResource,
				ArkiniElectronApi.channels.editorProjectUpsertItem,
				ArkiniElectronApi.channels.editorProjectUpsertResources,
			];
			app.once("will-quit", () => {
				for (const channel of channels) ipcMain.removeHandler(channel);
				registered = false;
			});
		}),
);
