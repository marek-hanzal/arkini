import { EventEmitter } from "node:events";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import type { EditorMcpPreferences } from "../../electron/main/editor-mcp/EditorMcpPreferences";
import { registerEditorMcpPreferencesIpcFx } from "../../electron/main/editor/registerEditorMcpPreferencesIpcFx";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";
import type { EditorMcpOwnership } from "../../server/editor-mcp/createEditorMcpOwnershipFx";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	let willQuit: (() => void) | undefined;
	return {
		handlers,
		module: {
			app: {
				once: (event: string, listener: () => void) => {
					if (event === "will-quit") willQuit = listener;
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
		reset: () => {
			willQuit?.();
			willQuit = undefined;
			handlers.clear();
		},
	};
});

vi.mock("electron", () => electron.module);

const createEvent = () => {
	const sender = new EventEmitter() as WebContents;
	return {
		event: {
			sender,
		} as IpcMainInvokeEvent,
		sender,
	};
};

const createTrustedRenderer = (trusted = true): TrustedRenderer => ({
	isTrustedUrl: () => trusted,
	isTrustedIpcSender: () => trusted,
	assertTrustedIpcSenderFx: () =>
		trusted
			? Effect.void
			: Effect.fail(
					new ElectronMainError({
						operation: "authorize MCP context test renderer",
						cause: "untrusted",
					}),
				),
	registerWindowFx: () => Effect.void,
});

const createOwnership = (): EditorMcpOwnership => {
	let projectContext: string | undefined;
	return {
		readStatus: () => ({
			type: "inactive",
		}),
		readProjectContext: () => projectContext,
		setProjectContext: vi.fn((projectId) => {
			projectContext = projectId;
		}),
		clearProjectContext: vi.fn((projectId) => {
			if (projectContext === projectId) projectContext = undefined;
		}),
		resetProjectContext: vi.fn(() => {
			projectContext = undefined;
		}),
		activateFx: Effect.succeed({
			type: "inactive",
		}),
		closeFx: Effect.void,
		closeSync: vi.fn(),
	};
};

const preferences: EditorMcpPreferences = {
	readPortFx: Effect.succeed(32_310),
	writePortFx: () => Effect.void,
};

const invoke = (event: IpcMainInvokeEvent, channel: string, candidate?: unknown) => {
	const handler = electron.handlers.get(channel);
	if (handler === undefined) throw new Error(`Missing IPC handler ${channel}.`);
	return handler(event, candidate);
};

afterEach(() => electron.reset());

describe("registerEditorMcpPreferencesIpcFx", () => {
	it("validates and owns one trusted renderer project context", async () => {
		const ownership = createOwnership();
		const { event, sender } = createEvent();
		Effect.runSync(
			registerEditorMcpPreferencesIpcFx({
				trustedRenderer: createTrustedRenderer(),
				preferences,
				ownership,
			}),
		);

		await expect(
			invoke(event, ArkiniElectronApi.channels.editorMcpProjectContextSet, "project-one"),
		).resolves.toBeUndefined();
		expect(ownership.readProjectContext()).toBe("project-one");
		await expect(
			invoke(
				event,
				ArkiniElectronApi.channels.editorMcpProjectContextClear,
				"another-project",
			),
		).resolves.toBeUndefined();
		expect(ownership.readProjectContext()).toBe("project-one");
		await expect(
			invoke(event, ArkiniElectronApi.channels.editorMcpProjectContextClear, "project-one"),
		).resolves.toBeUndefined();
		expect(ownership.readProjectContext()).toBeUndefined();

		await expect(
			invoke(event, ArkiniElectronApi.channels.editorMcpProjectContextSet, ""),
		).rejects.toBeDefined();
		expect(ownership.readProjectContext()).toBeUndefined();

		await invoke(event, ArkiniElectronApi.channels.editorMcpProjectContextSet, "project-one");
		sender.emit("did-start-loading");
		expect(ownership.readProjectContext()).toBeUndefined();
		await invoke(event, ArkiniElectronApi.channels.editorMcpProjectContextSet, "project-two");
		sender.emit("destroyed");
		expect(ownership.readProjectContext()).toBeUndefined();
	});

	it("rejects project context changes from an untrusted renderer", async () => {
		const ownership = createOwnership();
		const { event } = createEvent();
		Effect.runSync(
			registerEditorMcpPreferencesIpcFx({
				trustedRenderer: createTrustedRenderer(false),
				preferences,
				ownership,
			}),
		);

		await expect(
			invoke(event, ArkiniElectronApi.channels.editorMcpProjectContextSet, "project-one"),
		).rejects.toThrow("authorize MCP context test renderer");
		expect(ownership.readProjectContext()).toBeUndefined();
	});
});
