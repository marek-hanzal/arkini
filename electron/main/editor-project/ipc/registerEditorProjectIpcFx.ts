import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { createEditorProjectRequestParserFx } from "./createEditorProjectRequestParserFx";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { registerEditorBoardScenarioIpcFx } from "./registerEditorBoardScenarioIpcFx";

let registered = false;

export namespace registerEditorProjectIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: EditorProjectServiceOwnership;
	}
}

/** Registers editor-only IPC even when SQLite is unavailable. */
export const registerEditorProjectIpcFx = Effect.fn("registerEditorProjectIpcFx")(
	({ trustedRenderer, ownership }: registerEditorProjectIpcFx.Props) =>
		Effect.gen(function* () {
			const shouldRegister = yield* Effect.sync(() => {
				if (registered) return false;
				registered = true;
				return true;
			});
			if (!shouldRegister) return;
			const boardScenarioChannels = yield* registerEditorBoardScenarioIpcFx({
				ownership,
				trustedRenderer,
			});
			const requestParser = yield* createEditorProjectRequestParserFx();
			yield* Effect.sync(() => {
				const runAuthorized = <Value>(
					event: IpcMainInvokeEvent,
					operation: Effect.Effect<Value>,
				) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.andThen(operation)),
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
					executeEditorProjectRepositoryFx(
						"await-idle",
						ownership,
						Effect.void,
						(repository) => repository.awaitIdleFx,
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectList, () =>
					executeEditorProjectRepositoryFx(
						"list-projects",
						ownership,
						Effect.void,
						(repository) => repository.listProjectsFx,
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectRead, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-project",
						ownership,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.readProjectFx(projectId),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectCreate, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"create-project",
						ownership,
						requestParser.parseCreateProjectFx(candidate),
						(repository, request) => repository.createProjectFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectReplaceConfig, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"replace-config",
						ownership,
						requestParser.parseReplaceConfigFx(candidate),
						(repository, request) => repository.replaceConfigFx(request),
					),
				);
				handle(
					ArkiniElectronApi.channels.editorProjectReplaceResource,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"replace-resource",
							ownership,
							requestParser.parseReplaceResourceFx(candidate),
							(repository, request) => repository.replaceResourceFx(request),
						),
				);
				handle(ArkiniElectronApi.channels.editorProjectUpsertItem, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"upsert-item",
						ownership,
						requestParser.parseUpsertItemFx(candidate),
						(repository, request) => repository.upsertItemFx(request),
					),
				);
				handle(
					ArkiniElectronApi.channels.editorProjectUpsertResources,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"upsert-resource",
							ownership,
							requestParser.parseUpsertResourcesFx(candidate),
							(repository, request) => repository.upsertResourcesFx(request),
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
					...boardScenarioChannels,
				];
				app.once("will-quit", () => {
					for (const channel of channels) ipcMain.removeHandler(channel);
					registered = false;
				});
			});
		}),
);
