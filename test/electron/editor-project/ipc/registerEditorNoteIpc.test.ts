import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../../../electron/contract/ArkiniElectronApi";
import { registerEditorProjectIpcFx } from "../../../../electron/main/editor-project/ipc/registerEditorProjectIpcFx";
import type { TrustedRenderer } from "../../../../electron/main/security/TrustedRenderer";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcNote,
} from "./support/createEditorProjectIpcRepository";

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
		url: "arkini://app/editor/project-one/notes",
	},
} as IpcMainInvokeEvent;
const trustedRenderer: TrustedRenderer = {
	isTrustedUrl: () => true,
	isTrustedIpcSender: () => true,
	assertTrustedIpcSenderFx: () => Effect.void,
	registerWindowFx: () => Effect.void,
};
const invoke = (channel: string, candidate?: unknown) => {
	const handler = electron.handlers.get(channel);
	if (handler === undefined) throw new Error(`Missing IPC handler ${channel}.`);
	return handler(event, candidate);
};

afterEach(() => {
	electron.getWillQuit()?.();
	electron.handlers.clear();
});

describe("editor project-note IPC", () => {
	it("validates and forwards the complete note CRUD boundary", async () => {
		const repository = createEditorProjectIpcRepository();
		Effect.runSync(
			registerEditorProjectIpcFx({
				ownership: {
					type: "ready",
					repository,
				},
				trustedRenderer,
			}),
		);
		const key = {
			projectId: "project-one",
			noteId: editorProjectIpcNote.noteId,
		};

		await expect(
			invoke(ArkiniElectronApi.channels.editorNoteList, key.projectId),
		).resolves.toEqual({
			type: "success",
			value: [
				editorProjectIpcNote,
			],
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorNoteCreate, {
				projectId: key.projectId,
				content: "  New note  ",
			}),
		).resolves.toMatchObject({
			type: "success",
			value: {
				content: "New note",
			},
		});
		await expect(
			invoke(ArkiniElectronApi.channels.editorNoteUpdate, {
				...key,
				content: "Updated note",
			}),
		).resolves.toMatchObject({
			type: "success",
			value: {
				...key,
				content: "Updated note",
			},
		});
		await expect(invoke(ArkiniElectronApi.channels.editorNoteDelete, key)).resolves.toEqual({
			type: "success",
			value: undefined,
		});

		expect(repository.listNotesFx).toHaveBeenCalledWith(key.projectId);
		expect(repository.createNoteFx).toHaveBeenCalledWith({
			projectId: key.projectId,
			content: "New note",
		});
		expect(repository.updateNoteFx).toHaveBeenCalledWith({
			...key,
			content: "Updated note",
		});
		expect(repository.deleteNoteFx).toHaveBeenCalledWith(key);
	});

	it("rejects malformed note content before reporting unavailable ownership", async () => {
		Effect.runSync(
			registerEditorProjectIpcFx({
				ownership: {
					type: "unavailable",
					message: "Editor database could not be opened.",
				},
				trustedRenderer,
			}),
		);

		await expect(
			invoke(ArkiniElectronApi.channels.editorNoteCreate, {
				projectId: "project-one",
				content: "   ",
			}),
		).resolves.toMatchObject({
			type: "failure",
			error: {
				operation: "create-note",
				message: "The editor project request is invalid.",
			},
		});
	});
});
