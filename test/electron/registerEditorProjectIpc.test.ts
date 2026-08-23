import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import { registerEditorProjectIpcFx } from "../../electron/main/editor/registerEditorProjectIpcFx";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";
import type { EditorProjectServiceOwnership } from "../../server/editor/EditorProjectServiceOwnership";
import type { SqliteEditorProjectRepository } from "../../server/editor/createSqliteEditorProjectRepositoryFx";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	const appListeners = new Map<string, () => void>();
	return {
		appListeners,
		handlers,
		module: {
			app: {
				once: (event: string, listener: () => void) => {
					appListeners.set(event, listener);
				},
			},
			ipcMain: {
				handle: (
					channel: string,
					listener: (event: unknown, candidate?: unknown) => unknown,
				) => handlers.set(channel, listener),
				removeHandler: (channel: string) => handlers.delete(channel),
			},
		},
	};
});

vi.mock("electron", () => electron.module);

const event = {
	senderFrame: {
		url: "arkini://app/editor/welcome",
	},
} as IpcMainInvokeEvent;

const descriptor = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
};

const commit = {
	...descriptor,
	revision: 1,
	config: editorTestPayload.config,
};

const project = {
	...commit,
	resources: editorTestPayload.resources,
};

const createRepository = (): SqliteEditorProjectRepository => ({
	awaitIdleFx: Effect.void,
	createProjectFx: vi.fn(() => Effect.succeed(project)),
	listProjectsFx: Effect.succeed([
		descriptor,
	]),
	readProjectFx: vi.fn(() => Effect.succeed(project)),
	replaceConfigFx: vi.fn(() => Effect.succeed(commit)),
	replaceResourceFx: vi.fn(() => Effect.succeed(project)),
	upsertItemFx: vi.fn(() => Effect.succeed(commit)),
	upsertResourcesFx: vi.fn(() => Effect.succeed(project)),
	closeFx: Effect.void,
	closeSync: vi.fn(),
});

const createTrustedRenderer = (trusted = true): TrustedRenderer => ({
	isTrustedUrl: () => trusted,
	isTrustedIpcSender: () => trusted,
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
			ownership,
			trustedRenderer,
		}),
	);

const editorChannels = [
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

afterEach(() => {
	electron.appListeners.get("will-quit")?.();
	electron.appListeners.clear();
	electron.handlers.clear();
});

describe("registerEditorProjectIpcFx", () => {
	it("authorizes every editor handler before exposing status or repository operations", async () => {
		const repository = createRepository();
		register(
			{
				type: "ready",
				repository,
			},
			createTrustedRenderer(false),
		);

		for (const channel of editorChannels) {
			await expect(invoke(channel, {})).rejects.toThrow("authorize editor test renderer");
		}
		expect(repository.createProjectFx).not.toHaveBeenCalled();
		expect(repository.readProjectFx).not.toHaveBeenCalled();
		expect(repository.replaceConfigFx).not.toHaveBeenCalled();
		expect(repository.replaceResourceFx).not.toHaveBeenCalled();
		expect(repository.upsertItemFx).not.toHaveBeenCalled();
		expect(repository.upsertResourcesFx).not.toHaveBeenCalled();
	});

	it("validates and forwards every ready repository operation", async () => {
		const repository = createRepository();
		register({
			type: "ready",
			repository,
		});
		const createRequest = {
			projectId: "project-one",
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
			projectId: "project-one",
			currentId: "hero",
			expectedRevision: 0,
			config: editorTestPayload.config,
			resource: editorTestPayload.resources[0],
		};
		const upsertItemRequest = {
			projectId: "project-one",
			item: editorTestPayload.config.items.water,
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
		await expect(invoke(ArkiniElectronApi.channels.editorAwaitIdle)).resolves.toEqual({
			type: "success",
			value: undefined,
		});
		await expect(invoke(ArkiniElectronApi.channels.editorProjectList)).resolves.toEqual({
			type: "success",
			value: [
				descriptor,
			],
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectRead, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: project,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectCreate, createRequest),
		).resolves.toEqual({
			type: "success",
			value: project,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectReplaceConfig, replaceConfigRequest),
		).resolves.toEqual({
			type: "success",
			value: commit,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectReplaceResource, replaceResourceRequest),
		).resolves.toEqual({
			type: "success",
			value: project,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectUpsertItem, upsertItemRequest),
		).resolves.toEqual({
			type: "success",
			value: commit,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectUpsertResources, upsertResourcesRequest),
		).resolves.toEqual({
			type: "success",
			value: project,
		});

		expect(repository.readProjectFx).toHaveBeenCalledWith("project-one");
		expect(repository.createProjectFx).toHaveBeenCalledWith(createRequest);
		expect(repository.replaceConfigFx).toHaveBeenCalledWith(replaceConfigRequest);
		expect(repository.replaceResourceFx).toHaveBeenCalledWith(replaceResourceRequest);
		expect(repository.upsertItemFx).toHaveBeenCalledWith(upsertItemRequest);
		expect(repository.upsertResourcesFx).toHaveBeenCalledWith(upsertResourcesRequest);

		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectCreate, {
				...createRequest,
				projectId: "",
			}),
		).resolves.toEqual({
			type: "failure",
			error: {
				operation: "create-project",
				message: "The editor IPC request is invalid.",
			},
		});
		expect(repository.createProjectFx).toHaveBeenCalledOnce();
	});

	it("serializes repository failures into the stable public envelope", async () => {
		const repository: SqliteEditorProjectRepository = {
			...createRepository(),
			listProjectsFx: Effect.fail(
				new EditorProjectRepositoryError({
					operation: "list-projects",
					message: "SQLite read failed.",
					cause: new Error("private database detail"),
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
				message: "SQLite read failed.",
			},
		});
	});

	it("publishes unavailable status and rejects operations without a repository", async () => {
		register({
			type: "unavailable",
			message: "Editor database could not be opened.",
		});

		await expect(invoke(ArkiniElectronApi.channels.editorStatus)).resolves.toEqual({
			type: "unavailable",
			message: "Editor database could not be opened.",
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectRead, "project-one"),
		).resolves.toEqual({
			type: "failure",
			error: {
				operation: "read-project",
				message: "Editor database could not be opened.",
			},
		});
	});

	it("removes every handler on application shutdown and permits clean registration", () => {
		const repository = createRepository();
		register({
			type: "ready",
			repository,
		});
		expect(Array.from(electron.handlers.keys()).sort()).toEqual(
			[
				...editorChannels,
			].sort(),
		);

		electron.appListeners.get("will-quit")?.();
		expect(electron.handlers.size).toBe(0);

		register({
			type: "ready",
			repository,
		});
		expect(Array.from(electron.handlers.keys()).sort()).toEqual(
			[
				...editorChannels,
			].sort(),
		);
	});
});
