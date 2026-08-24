import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../../../electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "../../../../electron/main/ElectronMainError";
import type { EditorProjectServiceOwnership } from "../../../../electron/main/editor-project/EditorProjectServiceOwnership";
import { registerEditorProjectIpcFx } from "../../../../electron/main/editor-project/ipc/registerEditorProjectIpcFx";
import type { TrustedRenderer } from "../../../../electron/main/security/TrustedRenderer";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcCommit,
	editorProjectIpcDescriptor,
	editorProjectIpcProject,
} from "./support/createEditorProjectIpcRepository";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	const appListeners = new Map<string, () => void>();
	return {
		appListeners,
		handlers,
		module: {
			app: {
				once: (event: string, listener: () => void) => appListeners.set(event, listener),
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

const projectChannels = [
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
			...replaceConfigRequest,
			currentId: "hero",
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
		await expect(invoke(ArkiniElectronApi.channels.editorAwaitIdle)).resolves.toMatchObject({
			type: "success",
		});
		await expect(invoke(ArkiniElectronApi.channels.editorProjectList)).resolves.toEqual({
			type: "success",
			value: [
				editorProjectIpcDescriptor,
			],
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorProjectRead, "project-one"),
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
			invoke(ArkiniElectronApi.channels.editorProjectReplaceConfig, replaceConfigRequest),
		).resolves.toEqual({
			type: "success",
			value: editorProjectIpcCommit,
		});
		await invoke(
			ArkiniElectronApi.channels.editorProjectReplaceResource,
			replaceResourceRequest,
		);
		await invoke(ArkiniElectronApi.channels.editorProjectUpsertItem, upsertItemRequest);
		await invoke(
			ArkiniElectronApi.channels.editorProjectUpsertResources,
			upsertResourcesRequest,
		);

		expect(repository.createProjectFx).toHaveBeenCalledWith(createRequest);
		expect(repository.readProjectFx).toHaveBeenCalledWith("project-one");
		expect(repository.replaceConfigFx).toHaveBeenCalledWith(replaceConfigRequest);
		expect(repository.replaceResourceFx).toHaveBeenCalledWith(replaceResourceRequest);
		expect(repository.upsertItemFx).toHaveBeenCalledWith(upsertItemRequest);
		expect(repository.upsertResourcesFx).toHaveBeenCalledWith(upsertResourcesRequest);
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
	});

	it("publishes stable failures, unavailable status, and owns handler cleanup", async () => {
		const repository = {
			...createEditorProjectIpcRepository(),
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
		expect(electron.handlers.size).toBe(13);
		electron.appListeners.get("will-quit")?.();
		expect(electron.handlers.size).toBe(0);

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
