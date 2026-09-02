import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "~electron/main/ElectronMainError";
import type { DiagnosticLog } from "~electron/main/diagnostics/createDiagnosticLogFx";
import { registerEditorProjectIpcFx } from "~electron/main/editor-project/ipc/registerEditorProjectIpcFx";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import { createEditorProjectIpcRepository } from "./support/createEditorProjectIpcRepository";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	let willQuit: (() => void) | undefined;
	return {
		handlers,
		getWillQuit: () => willQuit,
		module: {
			app: {
				once: (_event: string, listener: () => void) => (willQuit = listener),
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
const boardChannels = [
	ArkiniElectronApi.channels.editorBoardScenarioList,
	ArkiniElectronApi.channels.editorBoardScenarioRead,
	ArkiniElectronApi.channels.editorBoardScenarioWrite,
	ArkiniElectronApi.channels.editorBoardScenarioDelete,
];
const diagnostics = {
	directoryPath: "/tmp/arkini-diagnostics",
	writeFx: () => Effect.void,
	writeApplicationFx: () => Effect.void,
	openDirectoryFx: Effect.void,
	closeFx: Effect.void,
} satisfies DiagnosticLog;

afterEach(() => {
	electron.getWillQuit()?.();
	electron.handlers.clear();
});

describe("editor Board-scenario IPC", () => {
	it("authorizes every handler before touching the repository", async () => {
		const repository = createEditorProjectIpcRepository();
		Effect.runSync(
			registerEditorProjectIpcFx({
				diagnostics,
				ownership: {
					type: "ready",
					repository,
				},
				trustedRenderer: createTrustedRenderer(false),
			}),
		);

		for (const channel of boardChannels) {
			await expect(invoke(channel, {})).rejects.toThrow("authorize editor test renderer");
		}
		expect(repository.listBoardScenariosFx).not.toHaveBeenCalled();
		expect(repository.readBoardScenarioFx).not.toHaveBeenCalled();
		expect(repository.writeBoardScenarioFx).not.toHaveBeenCalled();
		expect(repository.deleteBoardScenarioFx).not.toHaveBeenCalled();
	});

	it("validates and forwards every Board-scenario operation", async () => {
		const repository = createEditorProjectIpcRepository();
		Effect.runSync(
			registerEditorProjectIpcFx({
				diagnostics,
				ownership: {
					type: "ready",
					repository,
				},
				trustedRenderer: createTrustedRenderer(),
			}),
		);
		const key = {
			projectId: "project-one",
			name: "Scenario 1",
		};
		const write = {
			...key,
			expectedRevision: 1,
			bytes: Uint8Array.of(1),
		};

		await expect(
			invoke(ArkiniElectronApi.channels.editorBoardScenarioList, "project-one"),
		).resolves.toEqual({
			type: "success",
			value: [],
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorBoardScenarioRead, key),
		).resolves.toEqual({
			type: "success",
			value: null,
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorBoardScenarioWrite, write),
		).resolves.toMatchObject({
			type: "success",
			value: {
				...key,
				bytes: Uint8Array.of(1),
			},
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorBoardScenarioDelete, key),
		).resolves.toMatchObject({
			type: "success",
		});

		expect(repository.listBoardScenariosFx).toHaveBeenCalledWith("project-one");
		expect(repository.readBoardScenarioFx).toHaveBeenCalledWith(key);
		expect(vi.mocked(repository.writeBoardScenarioFx).mock.calls[0]?.[0]).toEqual(write);
		expect(repository.deleteBoardScenarioFx).toHaveBeenCalledWith(key);
		await expect(
			invoke(ArkiniElectronApi.channels.editorBoardScenarioWrite, {
				...write,
				bytes: new Uint8Array(),
			}),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "write-board-scenario",
			},
		});
		expect(repository.writeBoardScenarioFx).toHaveBeenCalledOnce();
	});

	it("rejects an invalid request before reporting unavailable ownership", async () => {
		Effect.runSync(
			registerEditorProjectIpcFx({
				diagnostics,
				ownership: {
					type: "unavailable",
					message: "Editor database could not be opened.",
				},
				trustedRenderer: createTrustedRenderer(),
			}),
		);

		await expect(
			invoke(ArkiniElectronApi.channels.editorBoardScenarioList, ""),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "list-board-scenarios",
				message: "The editor project request is invalid.",
			},
		});
	});
});
