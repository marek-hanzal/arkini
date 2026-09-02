import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect, Semaphore } from "effect";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { DiagnosticLog } from "../../diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { exportEditorJsonDirectoryFx } from "../exportEditorJsonDirectoryFx";
import { importEditorJsonDirectoryFx } from "../importEditorJsonDirectoryFx";
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
						new ProjectRepositoryError({
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
		readonly diagnostics: DiagnosticLog;
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: EditorProjectServiceOwnership;
	}
}

/** Registers editor-only IPC even when Editor persistence is unavailable. */
export const registerEditorProjectIpcFx = Effect.fn("registerEditorProjectIpcFx")(
	({ diagnostics, trustedRenderer, ownership }: registerEditorProjectIpcFx.Props) =>
		Effect.gen(function* () {
			const shouldRegister = yield* Effect.sync(() => {
				if (registered) return false;
				registered = true;
				return true;
			});
			if (!shouldRegister) return;
			const boardScenarioChannels = yield* registerEditorBoardScenarioIpcFx({
				diagnostics,
				ownership,
				trustedRenderer,
			});
			const noteChannels = yield* registerEditorNoteIpcFx({
				diagnostics,
				ownership,
				trustedRenderer,
			});
			const requestParser = yield* createEditorProjectRequestParserFx();
			const sourceExports = yield* Semaphore.make(1);
			yield* Effect.sync(() => {
				const runAuthorizedFn = <Value>(
					event: IpcMainInvokeEvent,
					operation: Effect.Effect<Value, never, never>,
				) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.andThen(operation)),
					);
				const handleFn = <Value>(
					channel: string,
					runFx: (
						event: IpcMainInvokeEvent,
						candidate: unknown,
					) => Effect.Effect<Value, never, never>,
				) =>
					ipcMain.handle(channel, (event, candidate) =>
						runAuthorizedFn(event, runFx(event, candidate)),
					);

				handleFn(ArkiniElectronApi.channels.editorStatus, () =>
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
				handleFn(ArkiniElectronApi.channels.editorAwaitIdle, () =>
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
				handleFn(ArkiniElectronApi.channels.editorProjectBuild, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"build-project",
						ownership,
						diagnostics,
						requestParser.parseBuildProjectFx(candidate),
						(repository, request) => repository.buildProjectFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectBuildRead, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-project-build",
						ownership,
						diagnostics,
						requestParser.parseReadProjectBuildFx(candidate),
						(repository, request) => repository.readProjectBuildFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectBuildSave, (event, candidate) =>
					executeEditorProjectRepositoryFx(
						"save-project-build",
						ownership,
						diagnostics,
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
				handleFn(ArkiniElectronApi.channels.editorProjectList, () =>
					executeEditorProjectRepositoryFx(
						"list-projects",
						ownership,
						diagnostics,
						Effect.void,
						(repository) => repository.listProjectsFx,
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectRead, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-project",
						ownership,
						diagnostics,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.readProjectFx(projectId),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectRefresh, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"refresh-project",
						ownership,
						diagnostics,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.refreshProjectFx(projectId),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectCreate, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"create-project",
						ownership,
						diagnostics,
						requestParser.parseCreateProjectFx(candidate),
						(repository, request) => repository.createProjectFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectDelete, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-project",
						ownership,
						diagnostics,
						requestParser.parseDeleteProjectIdFx(candidate),
						(repository, projectId) => repository.deleteProjectFx(projectId),
					),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
					(event, candidate) =>
						executeEditorProjectRepositoryFx(
							"export-json-directory",
							ownership,
							diagnostics,
							Effect.all({
								projectId: requestParser.parseProjectIdFx(candidate),
								window: readEditorWindowFx(event, "export-json-directory"),
							}),
							(repository, { projectId, window }) =>
								sourceExports.withPermits(1)(
									exportEditorJsonDirectoryFx({
										projectId,
										repository,
										window,
									}),
								),
						),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectImportJsonDirectory, (event) =>
					executeEditorProjectRepositoryFx(
						"import-json-directory",
						ownership,
						diagnostics,
						readEditorWindowFx(event, "import-json-directory"),
						(repository, window) =>
							importEditorJsonDirectoryFx({
								repository,
								window,
							}),
					),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectOpenDirectory,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"open-project-directory",
							ownership,
							diagnostics,
							requestParser.parseProjectRootFx(candidate),
							(repository, root) =>
								openInvalidEditorProjectDirectoryFx({
									repository,
									root,
								}),
						),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectReplaceConfig,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"replace-config",
							ownership,
							diagnostics,
							requestParser.parseReplaceConfigFx(candidate),
							(repository, request) => repository.replaceConfigFx(request),
						),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectReplaceResource,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"replace-resource",
							ownership,
							diagnostics,
							requestParser.parseReplaceResourceFx(candidate),
							(repository, request) => repository.replaceResourceFx(request),
						),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectSaveResource,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"save-resource",
							ownership,
							diagnostics,
							requestParser.parseSaveResourceFx(candidate),
							(repository, request) => repository.saveResourceFx(request),
						),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectUpsertItem, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"upsert-item",
						ownership,
						diagnostics,
						requestParser.parseUpsertItemFx(candidate),
						(repository, request) => repository.upsertItemFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorProjectDeleteItem, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-item",
						ownership,
						diagnostics,
						requestParser.parseDeleteItemFx(candidate),
						(repository, request) => repository.deleteItemFx(request),
					),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectDeleteResource,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"delete-resource",
							ownership,
							diagnostics,
							requestParser.parseDeleteResourceFx(candidate),
							(repository, request) => repository.deleteResourceFx(request),
						),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectUpsertResources,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"upsert-resource",
							ownership,
							diagnostics,
							requestParser.parseUpsertResourcesFx(candidate),
							(repository, request) => repository.upsertResourcesFx(request),
						),
				);
				handleFn(ArkiniElectronApi.channels.editorVersionStatus, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-version-status",
						ownership,
						diagnostics,
						requestParser.parseVersionStatusProjectIdFx(candidate),
						(repository, projectId) => repository.readVersionStatusFx(projectId),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorVersionList, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"list-versions",
						ownership,
						diagnostics,
						requestParser.parseVersionListProjectIdFx(candidate),
						(repository, projectId) => repository.listVersionsFx(projectId),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorVersionDiff, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"diff-versions",
						ownership,
						diagnostics,
						requestParser.parseVersionDiffFx(candidate),
						(repository, request) => repository.diffVersionsFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorVersionCommit, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"create-version",
						ownership,
						diagnostics,
						requestParser.parseVersionCommitFx(candidate),
						(repository, request) => repository.createVersionFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorVersionCheckout, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"checkout-version",
						ownership,
						diagnostics,
						requestParser.parseVersionCheckoutFx(candidate),
						(repository, request) => repository.checkoutVersionFx(request),
					),
				);
				handleFn(ArkiniElectronApi.channels.editorVersionTag, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"update-version-tag",
						ownership,
						diagnostics,
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
