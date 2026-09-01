import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ArkiniElectronApi as ArkiniElectronContract } from "~electron/contract/ArkiniElectronApi";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (...args: Array<unknown>) => unknown>();
	let exposed: ArkiniElectronApi.Api | undefined;
	return {
		handlers,
		contextBridge: {
			exposeInMainWorld: vi.fn((_name: string, api: ArkiniElectronApi.Api) => {
				exposed = api;
			}),
		},
		ipcRenderer: {
			invoke: vi.fn(),
			on: vi.fn((channel: string, handler: (...args: Array<unknown>) => unknown) => {
				handlers.set(channel, handler);
			}),
			send: vi.fn(),
		},
		readExposed: () => {
			if (exposed === undefined) throw new Error("Expected preload API exposure.");
			return exposed;
		},
		reset: () => {
			handlers.clear();
			exposed = undefined;
		},
	};
});

vi.mock("electron", () => ({
	contextBridge: electron.contextBridge,
	ipcRenderer: electron.ipcRenderer,
}));

const loadPreload = async () => {
	vi.resetModules();
	await import("~electron/preload/index");
	return electron.readExposed();
};

const requestBeforeClose = async () => {
	const handler = electron.handlers.get(ArkiniElectronContract.channels.beforeClose);
	if (handler === undefined) throw new Error("Expected before-close listener registration.");
	await handler();
};

const reportWindowVisible = () => {
	const handler = electron.handlers.get(ArkiniElectronContract.channels.windowVisible);
	if (handler === undefined) throw new Error("Expected window-visible listener registration.");
	handler();
};

const reportEditorProjectChanged = (projectId: string) => {
	const handler = electron.handlers.get(ArkiniElectronContract.channels.editorProjectChanged);
	if (handler === undefined) throw new Error("Expected editor-project listener registration.");
	handler(undefined, projectId);
};

const reportChatGptState = (state: { readonly type: "loading" | "ready" }) => {
	const handler = electron.handlers.get(ArkiniElectronContract.channels.chatGptStateChanged);
	if (handler === undefined) throw new Error("Expected ChatGPT state listener registration.");
	handler(undefined, state);
};

const requestEditorMcpVersionCheckout = async (request: {
	readonly projectId: string;
	readonly versionId: string;
}) => {
	const handler = electron.handlers.get(
		ArkiniElectronContract.channels.editorMcpVersionCheckoutRequest,
	);
	if (handler === undefined) throw new Error("Expected MCP version checkout listener.");
	const port = {
		close: vi.fn(),
		postMessage: vi.fn(),
	};
	await handler(
		{
			ports: [
				port,
			],
		},
		request,
	);
	return port;
};

describe("Electron preload lifecycle", () => {
	beforeEach(() => {
		electron.reset();
		electron.contextBridge.exposeInMainWorld.mockClear();
		electron.ipcRenderer.invoke.mockReset();
		electron.ipcRenderer.on.mockClear();
		electron.ipcRenderer.send.mockReset();
	});

	it("publishes one renderer-clock timestamp after the main window becomes visible", async () => {
		const api = await loadPreload();
		const visible = api.lifecycle.waitUntilVisibleFn();
		let settled = false;
		void visible.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		reportWindowVisible();
		const visibleAtMs = await visible;
		expect(visibleAtMs).toBeTypeOf("number");
		expect(await api.lifecycle.waitUntilVisibleFn()).toBe(visibleAtMs);
	});

	it("exposes preferred system languages through the localization capability", async () => {
		electron.ipcRenderer.invoke.mockResolvedValue([
			"cs-CZ",
			"en-GB",
		]);
		const api = await loadPreload();

		await expect(api.localization.readPreferredLanguagesFn()).resolves.toEqual([
			"cs-CZ",
			"en-GB",
		]);
		expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
			ArkiniElectronContract.channels.localizationPreferredLanguagesRead,
		);
	});

	it("routes the mounted editor project context through dedicated MCP IPC channels", async () => {
		electron.ipcRenderer.invoke.mockResolvedValue(undefined);
		const api = await loadPreload();

		await expect(api.editorMcp.setProjectContextFn("project-one")).resolves.toBeUndefined();
		await expect(api.editorMcp.clearProjectContextFn("project-one")).resolves.toBeUndefined();
		expect(electron.ipcRenderer.invoke).toHaveBeenNthCalledWith(
			1,
			ArkiniElectronContract.channels.editorMcpProjectContextSet,
			"project-one",
		);
		expect(electron.ipcRenderer.invoke).toHaveBeenNthCalledWith(
			2,
			ArkiniElectronContract.channels.editorMcpProjectContextClear,
			"project-one",
		);
	});

	it("exposes declarative ChatGPT surface placement and removable state listeners", async () => {
		electron.ipcRenderer.invoke.mockResolvedValue(undefined);
		const api = await loadPreload();
		const listener = vi.fn();
		const unsubscribe = api.chatGpt.onStateChangedFn(listener);
		const surface = {
			projectId: "project-one",
			bounds: {
				x: 64,
				y: 0,
				width: 800,
				height: 600,
			},
		};

		await expect(api.chatGpt.setSurfaceFn(surface)).resolves.toBeUndefined();
		reportChatGptState({
			type: "ready",
		});
		unsubscribe();
		reportChatGptState({
			type: "loading",
		});
		expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
			ArkiniElectronContract.channels.chatGptSurfaceSet,
			surface,
		);
		expect(listener).toHaveBeenCalledExactlyOnceWith({
			type: "ready",
		});
	});

	it("subscribes the renderer to main-process editor project mutations", async () => {
		const api = await loadPreload();
		const listener = vi.fn();
		const unsubscribe = api.editor.onProjectChangedFn(listener);

		reportEditorProjectChanged("project-one");
		unsubscribe();
		reportEditorProjectChanged("project-two");

		expect(listener).toHaveBeenCalledExactlyOnceWith("project-one");
	});

	it("returns renderer MCP version checkout completion through its private port", async () => {
		const api = await loadPreload();
		const listener = vi.fn(() => Promise.resolve());
		const unsubscribe = api.editorMcp.onVersionCheckoutRequestedFn(listener);
		const request = {
			projectId: "project-one",
			versionId: "version-one",
		};

		const port = await requestEditorMcpVersionCheckout(request);

		expect(listener).toHaveBeenCalledExactlyOnceWith(request);
		expect(port.postMessage).toHaveBeenCalledWith({
			type: "success",
		});
		expect(port.close).toHaveBeenCalledOnce();
		unsubscribe();
	});

	it("shares one pending native close request", async () => {
		const api = await loadPreload();
		const first = api.lifecycle.requestCloseFn();
		const second = api.lifecycle.requestCloseFn();

		expect(second).toBe(first);
		expect(electron.ipcRenderer.send).toHaveBeenCalledTimes(1);
		expect(electron.ipcRenderer.send).toHaveBeenCalledWith(
			ArkiniElectronContract.channels.requestClose,
		);
	});

	it("rejects failed close work and permits one truthful retry", async () => {
		const api = await loadPreload();
		const failure = new Error("save failed");
		api.lifecycle.onBeforeCloseFn(() => Promise.reject(failure));
		const first = api.lifecycle.requestCloseFn();

		await requestBeforeClose();
		await expect(first).rejects.toBe(failure);
		expect(electron.ipcRenderer.send).toHaveBeenCalledWith(
			ArkiniElectronContract.channels.closeFailed,
			"Error: save failed",
		);

		const retry = api.lifecycle.requestCloseFn();
		expect(retry).not.toBe(first);
		expect(electron.ipcRenderer.send).toHaveBeenCalledTimes(3);
		expect(electron.ipcRenderer.send).toHaveBeenLastCalledWith(
			ArkiniElectronContract.channels.requestClose,
		);
	});

	it("runs final save before presentation and resolves only before close readiness", async () => {
		const api = await loadPreload();
		const order: Array<string> = [];
		api.lifecycle.onBeforeCloseFn(async () => {
			order.push("save");
		});
		api.lifecycle.onBeforeCloseReadyFn(async () => {
			order.push("presentation");
		});
		const request = api.lifecycle.requestCloseFn();

		await requestBeforeClose();
		await expect(request).resolves.toBeUndefined();
		expect(order).toEqual([
			"save",
			"presentation",
		]);
		expect(electron.ipcRenderer.send).toHaveBeenLastCalledWith(
			ArkiniElectronContract.channels.closeReady,
		);
	});
});
