import { EventEmitter } from "node:events";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../../../electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "../../../../electron/main/ElectronMainError";
import type { EditorMcpOwnership } from "../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import { registerEditorMcpPreferencesIpcFx } from "../../../../electron/main/editor-mcp/ipc/registerEditorMcpPreferencesIpcFx";
import type { EditorMcpPreferences } from "../../../../electron/main/editor-mcp/preference/EditorMcpPreferences";
import type { TrustedRenderer } from "../../../../electron/main/security/TrustedRenderer";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, candidate?: unknown) => unknown>();
	let willQuit: (() => void) | undefined;
	class FakePort {
		peer?: FakePort;
		start = vi.fn();
		close = vi.fn();
		messageListener?: (event: { data: unknown }) => void;
		once(event: string, listener: (event: { data: unknown }) => void) {
			if (event === "message") this.messageListener = listener;
			return this;
		}
		postMessage(data: unknown) {
			this.peer?.messageListener?.({
				data,
			});
		}
	}
	class MessageChannelMain {
		readonly port1 = new FakePort();
		readonly port2 = new FakePort();
		constructor() {
			this.port1.peer = this.port2;
			this.port2.peer = this.port1;
		}
	}
	return {
		handlers,
		module: {
			MessageChannelMain,
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
	Object.assign(sender, {
		isDestroyed: vi.fn(() => false),
		postMessage: vi.fn(),
	});
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
		const requestCheckout = vi.mocked(ownership.setProjectContext).mock.calls[0]?.[1];
		if (requestCheckout === undefined) throw new Error("Expected renderer checkout binding.");
		const checkout = Effect.runPromise(requestCheckout("version-one"));
		const postMessage = vi.mocked(sender.postMessage);
		expect(postMessage).toHaveBeenCalledWith(
			ArkiniElectronApi.channels.editorMcpVersionCheckoutRequest,
			{
				projectId: "project-one",
				versionId: "version-one",
			},
			[
				expect.anything(),
			],
		);
		const transferredPort = postMessage.mock.calls[0]?.[2]?.[0];
		if (transferredPort === undefined) throw new Error("Expected transferred checkout port.");
		transferredPort.postMessage({
			type: "success",
		});
		await expect(checkout).resolves.toBeUndefined();
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
