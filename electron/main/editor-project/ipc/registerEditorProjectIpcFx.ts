import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { Effect, Semaphore } from "effect";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { exportEditorJsonDirectoryFx } from "../exportEditorJsonDirectoryFx";
import { importEditorJsonDirectoryFx } from "../importEditorJsonDirectoryFx";
import { openEditorExportDirectoryFx } from "../openEditorExportDirectoryFx";
import { openInvalidEditorProjectDirectoryFx } from "../openInvalidEditorProjectDirectoryFx";
import { saveEditorProjectBuildFx } from "../saveEditorProjectBuildFx";
import { createEditorProjectRequestParserFx } from "./createEditorProjectRequestParserFx";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { registerEditorBoardScenarioIpcFx } from "./registerEditorBoardScenarioIpcFx";
import { registerEditorNoteIpcFx } from "./registerEditorNoteIpcFx";

const readEditorWindowFx = (
	event: IpcMainInvokeEvent,
	operation: "export-json-directory" | "import-json-directory" | "save-project-build",
) =>
	Effect.sync(() => BrowserWindow.fromWebContents(event.sender)).pipe(
		Effect.flatMap((window) =>
			window === null
				? Effect.fail(
						new EditorProjectRepositoryError({
							operation,
							message: "The editor window is unavailable.",
						}),
					)
				: Effect.succeed(window),
		),
	);

let registered = false;

export namespace registerEditorProjectIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: EditorProjectServiceOwnership;
	}
}

/** Registers editor-only IPC even when Editor persistence is unavailable. */
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
			const noteChannels = yield* registerEditorNoteIpcFx({
				ownership,
				trustedRenderer,
			});
			const requestParser = yield* createEditorProjectRequestParserFx();
			const sourceExports = yield* Semaphore.make(1);
			const sourceExportRoots = new WeakMap<WebContents, string>();
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
					(ownership.type === "ready"
						? ownership.repository.awaitIdleFx
						: Effect.void
					).pipe(
						Effect.andThen(sourceExports.withPermits(1)(Effect.void)),
						Effect.match({
							onFailure: (error) => ({
								type: "failure" as const,
								error: {
									operation: error.operation,
									message: error.message,
								},
							}),
							onSuccess: () => ({
								type: "success" as const,
								value: undefined,
							}),
						}),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectBuild, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"build-project",
						ownership,
						requestParser.parseBuildProjectFx(candidate),
						(repository, request) => repository.buildProjectFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectBuildRead, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-project-build",
						ownership,
						requestParser.parseReadProjectBuildFx(candidate),
						(repository, request) => repository.readProjectBuildFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectBuildSave, (event, candidate) =>
					executeEditorProjectRepositoryFx(
						"save-project-build",
						ownership,
						Effect.all({
							request: requestParser.parseReadProjectBuildFx(candidate),
							window: readEditorWindowFx(event, "save-project-build"),
						}),
						(repository, { request, window }) =>
							saveEditorProjectBuildFx({
								repository,
								request,
								window,
							}),
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
				handle(ArkiniElectronApi.channels.editorProjectRefresh, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"refresh-project",
						ownership,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.refreshProjectFx(projectId),
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
				handle(ArkiniElectronApi.channels.editorProjectDelete, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-project",
						ownership,
						requestParser.parseDeleteProjectIdFx(candidate),
						(repository, projectId) => repository.deleteProjectFx(projectId),
					),
				);
				handle(
					ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
					(event, candidate) =>
						executeEditorProjectRepositoryFx(
							"export-json-directory",
							ownership,
							Effect.all({
								projectId: requestParser.parseProjectIdFx(candidate),
								window: readEditorWindowFx(event, "export-json-directory"),
							}),
							(repository, { projectId, window }) =>
								sourceExports
									.withPermits(1)(
										exportEditorJsonDirectoryFx({
											projectId,
											repository,
											window,
										}),
									)
									.pipe(
										Effect.tap((sourceExport) =>
											sourceExport === null
												? Effect.void
												: Effect.sync(() => {
														sourceExportRoots.set(
															event.sender,
															sourceExport.root,
														);
													}),
										),
									),
						),
				);
				handle(ArkiniElectronApi.channels.editorProjectImportJsonDirectory, (event) =>
					executeEditorProjectRepositoryFx(
						"import-json-directory",
						ownership,
						readEditorWindowFx(event, "import-json-directory"),
						(repository, window) =>
							importEditorJsonDirectoryFx({
								repository,
								window,
							}),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectOpenExportDirectory, (event) =>
					executeEditorProjectRepositoryFx(
						"open-export-directory",
						ownership,
						Effect.sync(() => sourceExportRoots.get(event.sender)).pipe(
							Effect.flatMap((root) =>
								root === undefined
									? Effect.fail(
											new EditorProjectRepositoryError({
												operation: "open-export-directory",
												message:
													"No completed Editor project export is available.",
											}),
										)
									: Effect.succeed(root),
							),
						),
						(_repository, root) => openEditorExportDirectoryFx(root),
					),
				);
				handle(ArkiniElectronApi.channels.editorProjectOpenDirectory, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"open-project-directory",
						ownership,
						requestParser.parseProjectRootFx(candidate),
						(repository, root) =>
							openInvalidEditorProjectDirectoryFx({
								repository,
								root,
							}),
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
				handle(ArkiniElectronApi.channels.editorProjectSaveResource, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"save-resource",
						ownership,
						requestParser.parseSaveResourceFx(candidate),
						(repository, request) => repository.saveResourceFx(request),
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
				handle(ArkiniElectronApi.channels.editorProjectDeleteItem, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-item",
						ownership,
						requestParser.parseDeleteItemFx(candidate),
						(repository, request) => repository.deleteItemFx(request),
					),
				);
				handle(
					ArkiniElectronApi.channels.editorProjectDeleteResource,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"delete-resource",
							ownership,
							requestParser.parseDeleteResourceFx(candidate),
							(repository, request) => repository.deleteResourceFx(request),
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
				handle(ArkiniElectronApi.channels.editorVersionStatus, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-version-status",
						ownership,
						requestParser.parseVersionStatusProjectIdFx(candidate),
						(repository, projectId) => repository.readVersionStatusFx(projectId),
					),
				);
				handle(ArkiniElectronApi.channels.editorVersionList, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"list-versions",
						ownership,
						requestParser.parseVersionListProjectIdFx(candidate),
						(repository, projectId) => repository.listVersionsFx(projectId),
					),
				);
				handle(ArkiniElectronApi.channels.editorVersionDiff, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"diff-versions",
						ownership,
						requestParser.parseVersionDiffFx(candidate),
						(repository, request) => repository.diffVersionsFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorVersionCommit, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"create-version",
						ownership,
						requestParser.parseVersionCommitFx(candidate),
						(repository, request) => repository.createVersionFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorVersionCheckout, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"checkout-version",
						ownership,
						requestParser.parseVersionCheckoutFx(candidate),
						(repository, request) => repository.checkoutVersionFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorVersionTag, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"update-version-tag",
						ownership,
						requestParser.parseVersionTagFx(candidate),
						(repository, request) => repository.updateVersionTagFx(request),
					),
				);
				const channels = [
					ArkiniElectronApi.channels.editorStatus,
					ArkiniElectronApi.channels.editorAwaitIdle,
					ArkiniElectronApi.channels.editorProjectBuild,
					ArkiniElectronApi.channels.editorProjectBuildRead,
					ArkiniElectronApi.channels.editorProjectBuildSave,
					ArkiniElectronApi.channels.editorProjectCreate,
					ArkiniElectronApi.channels.editorProjectDelete,
					ArkiniElectronApi.channels.editorProjectDeleteItem,
					ArkiniElectronApi.channels.editorProjectDeleteResource,
					ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
					ArkiniElectronApi.channels.editorProjectImportJsonDirectory,
					ArkiniElectronApi.channels.editorProjectList,
					ArkiniElectronApi.channels.editorProjectOpenExportDirectory,
					ArkiniElectronApi.channels.editorProjectOpenDirectory,
					ArkiniElectronApi.channels.editorProjectRead,
					ArkiniElectronApi.channels.editorProjectRefresh,
					ArkiniElectronApi.channels.editorProjectReplaceConfig,
					ArkiniElectronApi.channels.editorProjectReplaceResource,
					ArkiniElectronApi.channels.editorProjectSaveResource,
					ArkiniElectronApi.channels.editorProjectUpsertItem,
					ArkiniElectronApi.channels.editorProjectUpsertResources,
					ArkiniElectronApi.channels.editorVersionStatus,
					ArkiniElectronApi.channels.editorVersionList,
					ArkiniElectronApi.channels.editorVersionDiff,
					ArkiniElectronApi.channels.editorVersionCommit,
					ArkiniElectronApi.channels.editorVersionCheckout,
					ArkiniElectronApi.channels.editorVersionTag,
					...boardScenarioChannels,
					...noteChannels,
				];
				app.once("will-quit", () => {
					for (const channel of channels) ipcMain.removeHandler(channel);
					registered = false;
				});
			});
		}),
);
