import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect, Semaphore } from "effect";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { DiagnosticLog } from "../../diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { exportEditorJsonDirectoryFx } from "../exportEditorJsonDirectoryFx";
import { importEditorJsonDirectoryFx } from "../importEditorJsonDirectoryFx";
import { openInvalidEditorProjectDirectoryFx } from "../openInvalidEditorProjectDirectoryFx";
import { saveEditorProjectBuildFx } from "../saveEditorProjectBuildFx";
import { createEditorProjectRequestParserFx } from "./createEditorProjectRequestParserFx";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { registerEditorNoteIpcFx } from "./registerEditorNoteIpcFx";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { importEditorResourceFilesFx } from "../importEditorResourceFilesFx";
import { createFreshProjectFx } from "~/project-authoring/fx/createFreshProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

const readEditorWindowFx = (
	event: IpcMainInvokeEvent,
	operation:
		| "export-json-directory"
		| "import-json-directory"
		| "import-arkpack"
		| "optimize-resources"
		| "save-project-build",
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
		readonly bundledArkpacksRoot?: string;
		readonly diagnostics: DiagnosticLog;
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: EditorProjectServiceOwnership;
		readonly userArkpacksRoot?: string;
	}
}

/** Registers editor-only IPC even when Editor persistence is unavailable. */
export const registerEditorProjectIpcFx = Effect.fn("registerEditorProjectIpcFx")(
	({
		bundledArkpacksRoot = "",
		diagnostics,
		trustedRenderer,
		ownership,
		userArkpacksRoot = "",
	}: registerEditorProjectIpcFx.Props) =>
		Effect.gen(function* () {
			const shouldRegister = yield* Effect.sync(() => {
				if (registered) return false;
				registered = true;
				return true;
			});
			if (!shouldRegister) return;
			const noteChannels = yield* registerEditorNoteIpcFx({
				diagnostics,
				ownership,
				trustedRenderer,
			});
			const requestParser = yield* createEditorProjectRequestParserFx();
			const sourceTransfers = yield* Semaphore.make(1);
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
					sourceTransfers
						.withPermits(1)(
							ownership.type === "ready"
								? ownership.repository.awaitIdleFx
								: Effect.void,
						)
						.pipe(
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
						(repository, projectId) =>
							createFreshProjectFx(projectId).pipe(
								Effect.provideService(ProjectRepository, repository),
								Effect.mapError((cause) =>
									cause instanceof ProjectRepositoryError
										? cause
										: new ProjectRepositoryError({
												operation: "create-project",
												message: "The Editor project could not be created.",
												cause,
											}),
								),
							),
					),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectDismissInvalid,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"dismiss-invalid-project",
							ownership,
							diagnostics,
							requestParser.parseDismissInvalidProjectRootFx(candidate),
							(repository, root) => repository.dismissInvalidProjectFx(root),
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
								sourceTransfers.withPermits(1)(
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
				handleFn(ArkiniElectronApi.channels.editorProjectImportArkpack, (event) =>
					executeEditorProjectRepositoryFx(
						"import-arkpack",
						ownership,
						diagnostics,
						readEditorWindowFx(event, "import-arkpack"),
						(repository, window) =>
							Effect.tryPromise({
								try: () =>
									dialog.showOpenDialog(window, {
										properties: [
											"openFile",
										],
										filters: [
											{
												name: "Arkpack",
												extensions: [
													"arkpack",
												],
											},
										],
									}),
								catch: (cause) =>
									new ProjectRepositoryError({
										operation: "import-arkpack",
										message: "The Arkpack picker could not be opened.",
										cause,
									}),
							}).pipe(
								Effect.flatMap((selection) => {
									const arkpackPath = selection.filePaths[0];
									if (selection.canceled || arkpackPath === undefined)
										return Effect.succeed(null);
									return repository.importArkpackFileFx(arkpackPath).pipe(
										Effect.map((project) => ({
											projectId: project.projectId,
											title: project.title,
											version: project.version,
											createdAtMs: project.createdAtMs,
											updatedAtMs: project.updatedAtMs,
										})),
									);
								}),
							),
					),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectImportInstalledArkpack,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"import-arkpack",
							ownership,
							diagnostics,
							requestParser.parseProjectIdFx(candidate),
							(repository, packageId) => {
								const filename = readArkpackArtifactNameFn(packageId);
								const userPath = join(userArkpacksRoot, filename);
								const bundledPath = join(bundledArkpacksRoot, filename);
								return Effect.tryPromise({
									try: async () => {
										try {
											await access(userPath);
											return userPath;
										} catch {
											await access(bundledPath);
											return bundledPath;
										}
									},
									catch: (cause) =>
										new ProjectRepositoryError({
											operation: "import-arkpack",
											message: `Arkpack ${packageId} is not installed.`,
											cause,
										}),
								}).pipe(
									Effect.flatMap(repository.importArkpackFileFx),
									Effect.map((project) => ({
										projectId: project.projectId,
										title: project.title,
										version: project.version,
										createdAtMs: project.createdAtMs,
										updatedAtMs: project.updatedAtMs,
									})),
								);
							},
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
					ArkiniElectronApi.channels.editorProjectOptimizeResources,
					(event, candidate) =>
						executeEditorProjectRepositoryFx(
							"optimize-resources",
							ownership,
							diagnostics,
							Effect.all({
								request: requestParser.parseOptimizeResourcesFx(candidate),
								window: readEditorWindowFx(event, "optimize-resources"),
							}),
							(repository, { request, window }) =>
								repository.optimizeResourcesFx({
									...request,
									onProgressFn: (progress) => {
										if (window.isDestroyed()) return;
										window.webContents.send(
											ArkiniElectronApi.channels
												.editorProjectOptimizeResourcesProgress,
											{
												expectedRevision: request.expectedRevision,
												...progress,
												projectId: request.projectId,
											},
										);
									},
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
					ArkiniElectronApi.channels.editorProjectSaveResourceMetadata,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"save-resource-metadata",
							ownership,
							diagnostics,
							requestParser.parseSaveResourceMetadataFx(candidate),
							(repository, request) => repository.saveResourceMetadataFx(request),
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
					ArkiniElectronApi.channels.editorProjectImportResources,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"upsert-resource",
							ownership,
							diagnostics,
							requestParser.parseImportResourcesFx(candidate),
							(repository, request) =>
								sourceTransfers.withPermits(1)(
									importEditorResourceFilesFx({
										repository,
										request,
									}),
								),
						),
				);
				handleFn(
					ArkiniElectronApi.channels.editorProjectBuildVersionSave,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"save-build-version",
							ownership,
							diagnostics,
							requestParser.parseSaveBuildVersionFx(candidate),
							(repository, request) => repository.saveBuildVersionFx(request),
						),
				);
				const channels = [
					ArkiniElectronApi.channels.editorStatus,
					ArkiniElectronApi.channels.editorAwaitIdle,
					ArkiniElectronApi.channels.editorProjectBuild,
					ArkiniElectronApi.channels.editorProjectBuildVersionSave,
					ArkiniElectronApi.channels.editorProjectBuildSave,
					ArkiniElectronApi.channels.editorProjectCreate,
					ArkiniElectronApi.channels.editorProjectDismissInvalid,
					ArkiniElectronApi.channels.editorProjectDelete,
					ArkiniElectronApi.channels.editorProjectDeleteItem,
					ArkiniElectronApi.channels.editorProjectDeleteResource,
					ArkiniElectronApi.channels.editorProjectSaveResourceMetadata,
					ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
					ArkiniElectronApi.channels.editorProjectImportJsonDirectory,
					ArkiniElectronApi.channels.editorProjectImportArkpack,
					ArkiniElectronApi.channels.editorProjectImportInstalledArkpack,
					ArkiniElectronApi.channels.editorProjectImportResources,
					ArkiniElectronApi.channels.editorProjectList,
					ArkiniElectronApi.channels.editorProjectOpenDirectory,
					ArkiniElectronApi.channels.editorProjectOptimizeResources,
					ArkiniElectronApi.channels.editorProjectRead,
					ArkiniElectronApi.channels.editorProjectRefresh,
					ArkiniElectronApi.channels.editorProjectReplaceConfig,
					ArkiniElectronApi.channels.editorProjectReplaceResource,
					ArkiniElectronApi.channels.editorProjectUpsertItem,
					...noteChannels,
				];
				app.once("will-quit", () => {
					for (const channel of channels) ipcMain.removeHandler(channel);
					registered = false;
				});
			});
		}),
);
