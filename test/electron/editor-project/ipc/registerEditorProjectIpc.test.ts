import type { IpcMainInvokeEvent } from "electron";
import { Effect, Semaphore } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { ElectronMainError } from "~electron/main/ElectronMainError";
import type { DiagnosticLog } from "~electron/main/diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { registerEditorProjectIpcFx } from "~electron/main/editor-project/ipc/registerEditorProjectIpcFx";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcCommit,
	editorProjectIpcBuild,
	editorProjectIpcDescriptor,
	editorProjectIpcProject,
} from "./support/createEditorProjectIpcRepository";

const sourceImport = vi.hoisted(() => ({
	runFn: vi.fn(),
}));
vi.mock("~electron/main/editor-project/importEditorResourceFilesFx", () => ({
	importEditorResourceFilesFx: (props: unknown) => sourceImport.runFn(props),
}));

const sourceExport = vi.hoisted(() => ({
	effect: undefined as unknown,
}));

const completedSourceExport = {
	json: 9,
	resources: 3,
	revision: 4,
	root: "/tmp/source",
};
const writeApplicationLog = vi.fn();
const diagnostics = {
	directoryPath: "/tmp/serakki-diagnostics",
	writeFx: () => Effect.void,
	writeApplicationFx: (record) => Effect.sync(() => writeApplicationLog(record)),
	readLastGameFx: Effect.succeed(null),
	snapshotFx: Effect.succeed([]),
	openDirectoryFx: Effect.void,
	closeFx: Effect.void,
} satisfies DiagnosticLog;

vi.mock("~electron/main/editor-project/exportEditorJsonDirectoryFx", () => ({
	exportEditorJsonDirectoryFx: () => sourceExport.effect,
}));

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	const appListeners = new Map<string, () => void>();
	const editorWindow = {
		isDestroyed: vi.fn(() => false),
		webContents: {
			send: vi.fn(),
		},
	};
	return {
		appListeners,
		editorWindow,
		handlers,
		module: {
			app: {
				getAppPath: () => "/protected/serakki",
				getPath: (name: string) => `/protected/${name}`,
				once: (event: string, listener: () => void) => appListeners.set(event, listener),
			},
			BrowserWindow: {
				fromWebContents: () => editorWindow,
			},
			ipcMain: {
				handle: (
					channel: string,
					listener: (event: unknown, candidate?: unknown) => unknown,
				) => handlers.set(channel, listener),
				removeHandler: (channel: string) => handlers.delete(channel),
			},
			shell: {
				openPath: vi.fn(async () => ""),
			},
			dialog: {
				showMessageBox: vi.fn(),
				showOpenDialog: vi.fn(async () => ({
					canceled: true,
					filePaths: [],
				})),
				showSaveDialog: vi.fn(async () => ({
					canceled: true,
				})),
			},
		},
	};
});

vi.mock("electron", () => electron.module);

const event = {
	sender: {},
	senderFrame: {
		url: "serakki://app/serapacks",
	},
} as IpcMainInvokeEvent;
const createTrustedRenderer = (trusted = true): TrustedRenderer => ({
	isTrustedUrlFn: () => trusted,
	isTrustedIpcSenderFn: () => trusted,
	assertTrustedIpcSenderFx: () =>
		trusted
			? Effect.void
			: Effect.fail(
					new ElectronMainError({
						operation: "authorize editor test renderer",
						cause: "untrusted",
					}),
				),
	registerWindowFx: () => Effect.void,
});
const invoke = (channel: string, candidate?: unknown) => {
	const handler = electron.handlers.get(channel);
	if (handler === undefined) throw new Error(`Missing IPC handler ${channel}.`);
	return handler(event, candidate);
};
const register = (
	ownership: EditorProjectServiceOwnership,
	trustedRenderer = createTrustedRenderer(),
) =>
	Effect.runSync(
		registerEditorProjectIpcFx({
			diagnostics,
			ownership,
			trustedRenderer,
		}),
	);

const projectChannels = [
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
	SerakkiElectronApi.channels.editorProjectExportJsonDirectory,
	SerakkiElectronApi.channels.editorProjectImportJsonDirectory,
	SerakkiElectronApi.channels.editorProjectList,
	SerakkiElectronApi.channels.editorProjectOpenDirectory,
	SerakkiElectronApi.channels.editorProjectOptimizeResources,
	SerakkiElectronApi.channels.editorProjectRead,
	SerakkiElectronApi.channels.editorProjectRefresh,
	SerakkiElectronApi.channels.editorProjectReplaceConfig,
	SerakkiElectronApi.channels.editorProjectReplaceResource,
	SerakkiElectronApi.channels.editorProjectUpsertItem,
];

beforeEach(async () => {
	sourceExport.effect = Effect.succeed(completedSourceExport);
	writeApplicationLog.mockClear();
	electron.module.shell.openPath.mockClear();
	electron.editorWindow.isDestroyed.mockClear();
	electron.editorWindow.webContents.send.mockClear();
});

afterEach(() => {
	electron.appListeners.get("will-quit")?.();
	electron.appListeners.clear();
	electron.handlers.clear();
});

describe("registerEditorProjectIpcFx", () => {
	it("authorizes every project handler before exposing status or repository operations", async () => {
		const repository = createEditorProjectIpcRepository();
		register(
			{
				type: "ready",
				repository,
			},
			createTrustedRenderer(false),
		);

		for (const channel of projectChannels) {
			await expect(invoke(channel, {})).rejects.toThrow("authorize editor test renderer");
		}
		expect(repository.createProjectFx).not.toHaveBeenCalled();
	});

	it("validates and forwards every ready project operation", async () => {
		const repository = createEditorProjectIpcRepository();
		register({
			type: "ready",
			repository,
		});
		const replaceConfigRequest = {
			projectId: "project-one",
			expectedRevision: 0,
			config: editorTestPayload.config,
		};
		const replaceResourceRequest = {
			projectId: "project-one",
			expectedRevision: 0,
			resourceUid: "hero",
			resource: {
				uid: "hero",
				title: "Hero",
				type: "image",
			},
		};
		const upsertItemRequest = {
			expectedRevision: 0,
			projectId: "project-one",
			item: editorTestPayload.config.items.water,
		};
		const deleteItemRequest = {
			projectId: "project-one",
			itemUid: "water",
			expectedRevision: 0,
			force: false,
		};
		const deleteResourceRequest = {
			expectedRevision: 0,
			projectId: "project-one",
			resourceUid: "unused",
		};
		const optimizeResourcesRequest = {
			expectedRevision: 0,
			projectId: "project-one",
			resourceUids: [
				"hero",
				"item-water",
			],
			type: "artwork",
		};

		await expect(invoke(SerakkiElectronApi.channels.editorStatus)).resolves.toEqual({
			type: "ready",
		});
		await expect(invoke(SerakkiElectronApi.channels.editorAwaitIdle)).resolves.toMatchObject({
			type: "success",
		});
		const saveVersionRequest = {
			projectId: "project-one",
			version: {
				major: 2,
				minor: 3,
				suffix: "preview",
			},
		};
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectBuildVersionSave, saveVersionRequest),
		).resolves.toEqual({
			type: "success",
			value: saveVersionRequest.version,
		});
		expect(repository.saveBuildVersionFx).toHaveBeenCalledExactlyOnceWith(saveVersionRequest);
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectBuildVersionSave, {
				...saveVersionRequest,
				version: "2.3-preview",
			}),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "save-build-version",
			},
		});
		expect(repository.saveBuildVersionFx).toHaveBeenCalledOnce();
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectBuild, {
				projectId: "project-one",
			}),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcBuild,
		});
		expect(repository.buildProjectFx).toHaveBeenCalledWith({
			projectId: "project-one",
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectBuildSave, {
				projectId: "project-one",
				expectedRevision: 1,
				contentHash: "a".repeat(64),
			}),
		).resolves.toEqual({
			type: "success",
			value: false,
		});
		await expect(invoke(SerakkiElectronApi.channels.editorProjectList)).resolves.toEqual({
			type: "success",
			value: [
				{
					type: "valid",
					ownership: "managed",
					project: editorProjectIpcDescriptor,
				},
			],
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectRead, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcProject,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectRefresh, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcProject,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectCreate, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcProject,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectDelete, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectExportJsonDirectory, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: completedSourceExport,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectReplaceConfig, replaceConfigRequest),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcCommit,
		});
		await invoke(
			SerakkiElectronApi.channels.editorProjectReplaceResource,
			replaceResourceRequest,
		);
		await invoke(SerakkiElectronApi.channels.editorProjectUpsertItem, upsertItemRequest);
		await invoke(SerakkiElectronApi.channels.editorProjectDeleteItem, deleteItemRequest);
		await invoke(
			SerakkiElectronApi.channels.editorProjectDeleteResource,
			deleteResourceRequest,
		);
		const metadataRequest = {
			...deleteResourceRequest,
			title: "Dusty Plains",
		};
		await invoke(
			SerakkiElectronApi.channels.editorProjectSaveResourceMetadata,
			metadataRequest,
		);
		expect(repository.saveResourceMetadataFx).toHaveBeenCalledWith(metadataRequest);
		await invoke(
			SerakkiElectronApi.channels.editorProjectOptimizeResources,
			optimizeResourcesRequest,
		);
		expect(repository.createProjectFx).toHaveBeenCalledWith({
			version: {
				major: 1,
				minor: 0,
			},
			config: expect.objectContaining({
				meta: expect.objectContaining({
					id: "project-one",
				}),
			}),
			resources: [
				expect.objectContaining({
					uid: expect.any(String),
					type: "image",
					bytes: expect.any(Uint8Array),
				}),
			],
		});
		expect(repository.deleteProjectFx).toHaveBeenCalledWith("project-one");
		expect(repository.readProjectFx).toHaveBeenCalledWith("project-one");
		expect(repository.replaceConfigFx).toHaveBeenCalledWith(replaceConfigRequest);
		expect(repository.replaceResourceFx).toHaveBeenCalledWith(replaceResourceRequest);
		expect(repository.upsertItemFx).toHaveBeenCalledWith(upsertItemRequest);
		expect(repository.deleteItemFx).toHaveBeenCalledWith(deleteItemRequest);
		expect(repository.deleteResourceFx).toHaveBeenCalledWith(deleteResourceRequest);
		expect(repository.optimizeResourcesFx).toHaveBeenCalledWith({
			...optimizeResourcesRequest,
			onProgressFn: expect.any(Function),
		});
		expect(electron.editorWindow.webContents.send).toHaveBeenCalledWith(
			SerakkiElectronApi.channels.editorProjectOptimizeResourcesProgress,
			{
				completedResourceCount: 1,
				expectedRevision: optimizeResourcesRequest.expectedRevision,
				phase: "optimizing",
				projectId: optimizeResourcesRequest.projectId,
				totalResourceCount: 2,
			},
		);
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectCreate, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "create-project",
				message: "The editor project request is invalid.",
			},
		});
		expect(repository.createProjectFx).toHaveBeenCalledOnce();
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectDelete, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "delete-project",
				message: "The editor project request is invalid.",
			},
		});
		expect(repository.deleteProjectFx).toHaveBeenCalledOnce();
	});

	it("validates dismissal roots before dispatching the exact catalog identity", async () => {
		const repository = createEditorProjectIpcRepository();
		register({
			type: "ready",
			repository,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectDismissInvalid, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "dismiss-invalid-project",
			},
		});
		expect(repository.dismissInvalidProjectFx).not.toHaveBeenCalled();
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectDismissInvalid, "/projects/duplicate"),
		).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		expect(repository.dismissInvalidProjectFx).toHaveBeenCalledExactlyOnceWith(
			"/projects/duplicate",
		);
	});

	it("opens only an exact project root currently listed as invalid", async () => {
		const repository = {
			...createEditorProjectIpcRepository(),
			listProjectsFx: Effect.succeed([
				{
					type: "invalid" as const,
					root: "/projects/broken",
					title: "broken",
					validationError: "game.json is invalid",
				},
			]),
		};
		register({
			type: "ready",
			repository,
		});

		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectOpenDirectory, "/projects/forged"),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "open-project-directory",
			},
		});
		expect(electron.module.shell.openPath).not.toHaveBeenCalled();
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectOpenDirectory, "/projects/broken"),
		).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		expect(electron.module.shell.openPath).toHaveBeenCalledWith("/projects/broken");
	});

	it("does not report the editor idle while an admitted source export is running", async () => {
		const repository = createEditorProjectIpcRepository();
		let releaseExport: (() => void) | undefined;
		let markStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		sourceExport.effect = Effect.promise(
			() =>
				new Promise<null>((resolve) => {
					markStarted?.();
					releaseExport = () => resolve(null);
				}),
		);
		register({
			type: "ready",
			repository,
		});

		const exporting = invoke(
			SerakkiElectronApi.channels.editorProjectExportJsonDirectory,
			"project-one",
		);
		await started;
		let idleSettled = false;
		const idle = Promise.resolve(invoke(SerakkiElectronApi.channels.editorAwaitIdle)).finally(
			() => {
				idleSettled = true;
			},
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(idleSettled).toBe(false);

		releaseExport?.();
		await expect(exporting).resolves.toEqual({
			type: "success",
			value: null,
		});
		await expect(idle).resolves.toMatchObject({
			type: "success",
		});
	});

	it.each([
		false,
		true,
	])(
		"waits for native import preparation and releases its permit after failure=%s",
		async (fail) => {
			const operations = Effect.runSync(Semaphore.make(1));
			const base = createEditorProjectIpcRepository();
			const repository = {
				...base,
				awaitIdleFx: operations.withPermits(1)(Effect.void),
				upsertResourceFilesFx: (props: Parameters<typeof base.upsertResourceFilesFx>[0]) =>
					operations.withPermits(1)(base.upsertResourceFilesFx(props)),
			};
			let markStarted!: () => void;
			const started = new Promise<void>((resolve) => {
				markStarted = resolve;
			});
			let finishPreparation!: () => void;
			const prepared = new Promise<void>((resolve) => {
				finishPreparation = resolve;
			});
			sourceImport.runFn.mockImplementation(() =>
				Effect.gen(function* () {
					markStarted();
					yield* Effect.promise(() => prepared);
					if (fail)
						return yield* Effect.fail(
							new ProjectRepositoryError({
								operation: "upsert-resource",
								message: "Preparation failed.",
							}),
						);
					const project = yield* repository.upsertResourceFilesFx({
						projectId: "project-one",
						resources: [],
					});
					return {
						project,
						resourceUids: [],
					};
				}),
			);
			register({
				type: "ready",
				repository,
			});
			const importing = invoke(SerakkiElectronApi.channels.editorProjectImportResources, {
				projectId: "project-one",
				source: "files",
				type: "artwork",
				files: [
					{
						name: "source.png",
						path: "/selected/source.png",
					},
				],
			});
			await started;
			let idleSettled = false;
			const idle = Promise.resolve(
				invoke(SerakkiElectronApi.channels.editorAwaitIdle),
			).finally(() => {
				idleSettled = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(idleSettled).toBe(false);
			finishPreparation();
			await expect(importing).resolves.toMatchObject({
				type: fail ? "failure" : "success",
			});
			await expect(idle).resolves.toMatchObject({
				type: "success",
			});
		},
	);

	it("preserves conflict recovery identity across IPC and logs revision transitions without config", async () => {
		const repository = createEditorProjectIpcRepository();
		register({
			type: "ready",
			repository,
		});
		const request = {
			projectId: "project-one",
			expectedRevision: 0,
			config: editorTestPayload.config,
		};
		await invoke(SerakkiElectronApi.channels.editorProjectReplaceConfig, request);
		const record = writeApplicationLog.mock.calls.find(
			([entry]) => entry.message === "Editor operation completed: replace-config",
		)?.[0];
		expect(JSON.parse(record.body)).toEqual({
			source: "editor-ipc",
			request: {
				projectId: "project-one",
				expectedRevision: 0,
			},
			result: {
				projectId: "project-one",
				previousRevision: 0,
				revision: 1,
			},
		});
		vi.spyOn(repository, "replaceConfigFx").mockReturnValueOnce(
			Effect.fail(
				new ProjectRepositoryError({
					operation: "replace-config",
					reason: "revision-conflict",
					message: "Detailed revision conflict.",
				}),
			),
		);
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectReplaceConfig, request),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				reason: "revision-conflict",
			},
		});
	});

	it("publishes stable failures, unavailable status, and owns handler cleanup", async () => {
		const repository = {
			...createEditorProjectIpcRepository(),
			listProjectsFx: Effect.fail(
				new ProjectRepositoryError({
					operation: "list-projects",
					message: "Editor storage read failed.",
					cause: new Error("private storage detail"),
				}),
			),
		};
		register({
			type: "ready",
			repository,
		});
		await expect(invoke(SerakkiElectronApi.channels.editorProjectList)).resolves.toEqual({
			type: "failure",
			error: {
				operation: "list-projects",
				message: "Editor storage read failed.",
			},
		});
		expect(writeApplicationLog).toHaveBeenCalledWith({
			level: "error",
			message: "Editor operation failed: list-projects",
			body: expect.stringContaining("Phase: repository execution\n\n"),
		});
		expect(writeApplicationLog.mock.calls[0]?.[0]?.body).toContain("private storage detail");
		expect(writeApplicationLog.mock.calls[0]?.[0]?.body).not.toContain(
			"operation: list-projects",
		);
		expect(writeApplicationLog.mock.calls[0]?.[0]?.body).not.toContain(
			"_tag: EditorProjectRepositoryError",
		);
		for (const channel of projectChannels) expect(electron.handlers.has(channel)).toBe(true);
		electron.appListeners.get("will-quit")?.();
		for (const channel of projectChannels) expect(electron.handlers.has(channel)).toBe(false);

		register({
			type: "unavailable",
			message: "Editor storage could not be opened.",
		});
		await expect(invoke(SerakkiElectronApi.channels.editorStatus)).resolves.toEqual({
			type: "unavailable",
			message: "Editor storage could not be opened.",
		});
		await expect(invoke(SerakkiElectronApi.channels.editorAwaitIdle)).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectRead, "project-one"),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "read-project",
			},
		});
		await expect(
			invoke(SerakkiElectronApi.channels.editorProjectRead, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "read-project",
				message: "The editor project request is invalid.",
			},
		});
	});
});
