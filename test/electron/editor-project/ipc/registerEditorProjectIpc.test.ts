import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "~electron/main/ElectronMainError";
import type { DiagnosticLog } from "~electron/main/diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "~electron/main/editor-project/EditorProjectServiceOwnership";
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
	editorProjectIpcVersion,
} from "./support/createEditorProjectIpcRepository";

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
	directoryPath: "/tmp/arkini-diagnostics",
	writeFx: () => Effect.void,
	writeApplicationFx: (record) => Effect.sync(() => writeApplicationLog(record)),
	openDirectoryFx: Effect.void,
	closeFx: Effect.void,
} satisfies DiagnosticLog;

vi.mock("~electron/main/editor-project/exportEditorJsonDirectoryFx", () => ({
	exportEditorJsonDirectoryFx: () => sourceExport.effect,
}));

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	const appListeners = new Map<string, () => void>();
	return {
		appListeners,
		handlers,
		module: {
			app: {
				getAppPath: () => "/protected/arkini",
				getPath: (name: string) => `/protected/${name}`,
				once: (event: string, listener: () => void) => appListeners.set(event, listener),
			},
			BrowserWindow: {
				fromWebContents: () => ({}),
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
		url: "arkini://app/editor/welcome",
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
];

beforeEach(async () => {
	sourceExport.effect = Effect.succeed(completedSourceExport);
	writeApplicationLog.mockClear();
	electron.module.shell.openPath.mockClear();
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
		const createRequest = {
			version: editorTestPayload.version,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		};
		const replaceConfigRequest = {
			projectId: "project-one",
			expectedRevision: 0,
			config: editorTestPayload.config,
		};
		const replaceResourceRequest = {
			...replaceConfigRequest,
			currentId: "hero",
			resource: editorTestPayload.resources[0],
		};
		const upsertItemRequest = {
			expectedRevision: 0,
			projectId: "project-one",
			item: editorTestPayload.config.items.water,
		};
		const saveResourceRequest = {
			expectedRevision: 0,
			overwrite: false,
			projectId: "project-one",
			resource: editorTestPayload.resources[0],
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
			resourceId: "unused",
		};
		const upsertResourcesRequest = {
			projectId: "project-one",
			resources: [
				editorTestPayload.resources[0],
			],
		};

		await expect(invoke(ArkiniElectronApi.channels.editorStatus)).resolves.toEqual({
			type: "ready",
		});
		await expect(invoke(ArkiniElectronApi.channels.editorAwaitIdle)).resolves.toMatchObject({
			type: "success",
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectBuild, {
				projectId: "project-one",
				expectedRevision: 1,
			}),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcBuild,
		});
		expect(repository.buildProjectFx).toHaveBeenCalledWith({
			projectId: "project-one",
			expectedRevision: 1,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectBuildRead, {
				projectId: "project-one",
				expectedRevision: 1,
				contentHash: "a".repeat(64),
			}),
		).resolves.toEqual({
			type: "success",
			value: {
				bytes: new Uint8Array([
					1,
					2,
					3,
				]),
			},
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectBuildSave, {
				projectId: "project-one",
				expectedRevision: 1,
				contentHash: "a".repeat(64),
			}),
		).resolves.toEqual({
			type: "success",
			value: false,
		});
		await expect(invoke(ArkiniElectronApi.channels.editorProjectList)).resolves.toEqual({
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
			invoke(ArkiniElectronApi.channels.editorProjectRead, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcProject,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectRefresh, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcProject,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectCreate, createRequest),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcProject,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectDelete, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectExportJsonDirectory, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: completedSourceExport,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectReplaceConfig, replaceConfigRequest),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcCommit,
		});
		await invoke(
			ArkiniElectronApi.channels.editorProjectReplaceResource,
			replaceResourceRequest,
		);
		await invoke(ArkiniElectronApi.channels.editorProjectSaveResource, saveResourceRequest);
		await invoke(ArkiniElectronApi.channels.editorProjectUpsertItem, upsertItemRequest);
		await invoke(ArkiniElectronApi.channels.editorProjectDeleteItem, deleteItemRequest);
		await invoke(ArkiniElectronApi.channels.editorProjectDeleteResource, deleteResourceRequest);
		await invoke(
			ArkiniElectronApi.channels.editorProjectUpsertResources,
			upsertResourcesRequest,
		);
		const versionReference = {
			type: "version" as const,
			versionId: editorProjectIpcVersion.versionId,
		};
		const versionDiffRequest = {
			projectId: "project-one",
			from: versionReference,
			to: {
				type: "current" as const,
			},
		};
		const versionCommitRequest = {
			projectId: "project-one",
			subject: "Initial state",
		};
		const versionCheckoutRequest = {
			projectId: "project-one",
			versionId: editorProjectIpcVersion.versionId,
		};
		const versionTagRequest = {
			...versionCheckoutRequest,
			tag: "safe",
		};
		await expect(
			invoke(ArkiniElectronApi.channels.editorVersionStatus, "project-one"),
		).resolves.toMatchObject({
			type: "success",
			value: {
				dirty: true,
			},
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorVersionList, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: [
				editorProjectIpcVersion,
			],
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorVersionDiff, versionDiffRequest),
		).resolves.toMatchObject({
			type: "success",
			value: {
				hasChanges: false,
			},
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorVersionCommit, versionCommitRequest),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcVersion,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorVersionCheckout, versionCheckoutRequest),
		).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorVersionTag, versionTagRequest),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcVersion,
		});

		expect(repository.createProjectFx).toHaveBeenCalledWith(createRequest);
		expect(repository.deleteProjectFx).toHaveBeenCalledWith("project-one");
		expect(repository.readProjectFx).toHaveBeenCalledWith("project-one");
		expect(repository.replaceConfigFx).toHaveBeenCalledWith(replaceConfigRequest);
		expect(repository.replaceResourceFx).toHaveBeenCalledWith(replaceResourceRequest);
		expect(repository.saveResourceFx).toHaveBeenCalledWith(saveResourceRequest);
		expect(repository.upsertItemFx).toHaveBeenCalledWith(upsertItemRequest);
		expect(repository.deleteItemFx).toHaveBeenCalledWith(deleteItemRequest);
		expect(repository.deleteResourceFx).toHaveBeenCalledWith(deleteResourceRequest);
		expect(repository.upsertResourcesFx).toHaveBeenCalledWith(upsertResourcesRequest);
		expect(repository.readVersionStatusFx).toHaveBeenCalledWith("project-one");
		expect(repository.listVersionsFx).toHaveBeenCalledWith("project-one");
		expect(repository.diffVersionsFx).toHaveBeenCalledWith(versionDiffRequest);
		expect(repository.createVersionFx).toHaveBeenCalledWith(versionCommitRequest);
		expect(repository.checkoutVersionFx).toHaveBeenCalledWith(versionCheckoutRequest);
		expect(repository.updateVersionTagFx).toHaveBeenCalledWith(versionTagRequest);
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectCreate, {
				...createRequest,
				projectId: "",
			}),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "create-project",
				message: "The editor project request is invalid.",
			},
		});
		expect(repository.createProjectFx).toHaveBeenCalledOnce();
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectDelete, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "delete-project",
				message: "The editor project request is invalid.",
			},
		});
		expect(repository.deleteProjectFx).toHaveBeenCalledOnce();
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
			invoke(ArkiniElectronApi.channels.editorProjectOpenDirectory, "/projects/forged"),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "open-project-directory",
			},
		});
		expect(electron.module.shell.openPath).not.toHaveBeenCalled();
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectOpenDirectory, "/projects/broken"),
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
			ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
			"project-one",
		);
		await started;
		let idleSettled = false;
		const idle = Promise.resolve(invoke(ArkiniElectronApi.channels.editorAwaitIdle)).finally(
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
		await expect(invoke(ArkiniElectronApi.channels.editorProjectList)).resolves.toEqual({
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
		await expect(invoke(ArkiniElectronApi.channels.editorStatus)).resolves.toEqual({
			type: "unavailable",
			message: "Editor storage could not be opened.",
		});
		await expect(invoke(ArkiniElectronApi.channels.editorAwaitIdle)).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectRead, "project-one"),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "read-project",
			},
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectRead, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "read-project",
				message: "The editor project request is invalid.",
			},
		});
	});
});
