import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect, Semaphore } from "effect";

import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
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
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
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
		| "import-serapack"
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
		readonly bundledSerapacksRoot?: string;
		readonly diagnostics: DiagnosticLog;
		readonly trustedRenderer: TrustedRenderer;
		readonly ownership: EditorProjectServiceOwnership;
		readonly userSerapacksRoot?: string;
	}
}

/** Registers editor-only IPC even when Editor persistence is unavailable. */
export const registerEditorProjectIpcFx = Effect.fn("registerEditorProjectIpcFx")(
	({
		bundledSerapacksRoot = "",
		diagnostics,
		trustedRenderer,
		ownership,
		userSerapacksRoot = "",
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

				handleFn(SerakkiElectronApi.channels.editorStatus, () =>
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
				handleFn(SerakkiElectronApi.channels.editorAwaitIdle, () =>
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
				handleFn(SerakkiElectronApi.channels.editorProjectBuild, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"build-project",
						ownership,
						diagnostics,
						requestParser.parseBuildProjectFx(candidate),
						(repository, request) => repository.buildProjectFx(request),
					),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectBuildSave, (event, candidate) =>
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
				handleFn(SerakkiElectronApi.channels.editorProjectList, () =>
					executeEditorProjectRepositoryFx(
						"list-projects",
						ownership,
						diagnostics,
						Effect.void,
						(repository) => repository.listProjectsFx,
					),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectRead, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"read-project",
						ownership,
						diagnostics,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.readProjectFx(projectId),
					),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectRefresh, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"refresh-project",
						ownership,
						diagnostics,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.refreshProjectFx(projectId),
					),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectCreate, (_event, candidate) =>
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
					SerakkiElectronApi.channels.editorProjectDismissInvalid,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"dismiss-invalid-project",
							ownership,
							diagnostics,
							requestParser.parseDismissInvalidProjectRootFx(candidate),
							(repository, root) => repository.dismissInvalidProjectFx(root),
						),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectDelete, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-project",
						ownership,
						diagnostics,
						requestParser.parseDeleteProjectIdFx(candidate),
						(repository, projectId) => repository.deleteProjectFx(projectId),
					),
				);
				handleFn(
					SerakkiElectronApi.channels.editorProjectExportJsonDirectory,
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
				handleFn(SerakkiElectronApi.channels.editorProjectImportJsonDirectory, (event) =>
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
				handleFn(SerakkiElectronApi.channels.editorProjectImportSerapack, (event) =>
					executeEditorProjectRepositoryFx(
						"import-serapack",
						ownership,
						diagnostics,
						readEditorWindowFx(event, "import-serapack"),
						(repository, window) =>
							Effect.tryPromise({
								try: () =>
									dialog.showOpenDialog(window, {
										properties: [
											"openFile",
										],
										filters: [
											{
												name: "Serapack",
												extensions: [
													"serapack",
												],
											},
										],
									}),
								catch: (cause) =>
									new ProjectRepositoryError({
										operation: "import-serapack",
										message: "The Serapack picker could not be opened.",
										cause,
									}),
							}).pipe(
								Effect.flatMap((selection) => {
									const serapackPath = selection.filePaths[0];
									if (selection.canceled || serapackPath === undefined)
										return Effect.succeed(null);
									return repository.importSerapackFileFx(serapackPath).pipe(
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
					SerakkiElectronApi.channels.editorProjectImportInstalledSerapack,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"import-serapack",
							ownership,
							diagnostics,
							requestParser.parseProjectIdFx(candidate),
							(repository, packageId) => {
								const filename = readSerapackArtifactNameFn(packageId);
								const userPath = join(userSerapacksRoot, filename);
								const bundledPath = join(bundledSerapacksRoot, filename);
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
											operation: "import-serapack",
											message: `Serapack ${packageId} is not installed.`,
											cause,
										}),
								}).pipe(
									Effect.flatMap(repository.importSerapackFileFx),
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
					SerakkiElectronApi.channels.editorProjectOpenDirectory,
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
					SerakkiElectronApi.channels.editorProjectOptimizeResources,
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
											SerakkiElectronApi.channels
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
					SerakkiElectronApi.channels.editorProjectReplaceConfig,
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
					SerakkiElectronApi.channels.editorProjectReplaceResource,
					(_event, candidate) =>
						executeEditorProjectRepositoryFx(
							"replace-resource",
							ownership,
							diagnostics,
							requestParser.parseReplaceResourceFx(candidate),
							(repository, request) => repository.replaceResourceFx(request),
						),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectUpsertItem, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"upsert-item",
						ownership,
						diagnostics,
						requestParser.parseUpsertItemFx(candidate),
						(repository, request) => repository.upsertItemFx(request),
					),
				);
				handleFn(SerakkiElectronApi.channels.editorProjectDeleteItem, (_event, candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-item",
						ownership,
						diagnostics,
						requestParser.parseDeleteItemFx(candidate),
						(repository, request) => repository.deleteItemFx(request),
					),
				);
				handleFn(
					SerakkiElectronApi.channels.editorProjectSaveResourceMetadata,
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
					SerakkiElectronApi.channels.editorProjectDeleteResource,
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
					SerakkiElectronApi.channels.editorProjectImportResources,
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
					SerakkiElectronApi.channels.editorProjectBuildVersionSave,
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
					SerakkiElectronApi.channels.editorStatus,
					SerakkiElectronApi.channels.editorAwaitIdle,
					SerakkiElectronApi.channels.editorProjectBuild,
					SerakkiElectronApi.channels.editorProjectBuildVersionSave,
					SerakkiElectronApi.channels.editorProjectBuildSave,
					SerakkiElectronApi.channels.editorProjectCreate,
					SerakkiElectronApi.channels.editorProjectDismissInvalid,
					SerakkiElectronApi.channels.editorProjectDelete,
					SerakkiElectronApi.channels.editorProjectDeleteItem,
					SerakkiElectronApi.channels.editorProjectDeleteResource,
					SerakkiElectronApi.channels.editorProjectSaveResourceMetadata,
					SerakkiElectronApi.channels.editorProjectExportJsonDirectory,
					SerakkiElectronApi.channels.editorProjectImportJsonDirectory,
					SerakkiElectronApi.channels.editorProjectImportSerapack,
					SerakkiElectronApi.channels.editorProjectImportInstalledSerapack,
					SerakkiElectronApi.channels.editorProjectImportResources,
					SerakkiElectronApi.channels.editorProjectList,
					SerakkiElectronApi.channels.editorProjectOpenDirectory,
					SerakkiElectronApi.channels.editorProjectOptimizeResources,
					SerakkiElectronApi.channels.editorProjectRead,
					SerakkiElectronApi.channels.editorProjectRefresh,
					SerakkiElectronApi.channels.editorProjectReplaceConfig,
					SerakkiElectronApi.channels.editorProjectReplaceResource,
					SerakkiElectronApi.channels.editorProjectUpsertItem,
					...noteChannels,
				];
				app.once("will-quit", () => {
					for (const channel of channels) ipcMain.removeHandler(channel);
					registered = false;
				});
			});
		}),
);
