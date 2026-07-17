import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { ArkiniDesktopApi as ArkiniDesktopContract } from "../../desktop/ArkiniDesktopApi";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (...args: Array<unknown>) => unknown>();
	let exposed: ArkiniDesktopApi.Api | undefined;
	return {
		handlers,
		contextBridge: {
			exposeInMainWorld: vi.fn((_name: string, api: ArkiniDesktopApi.Api) => {
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
	await import("../../electron/preload/index");
	return electron.readExposed();
};

const requestBeforeClose = async () => {
	const handler = electron.handlers.get(ArkiniDesktopContract.channels.beforeClose);
	if (handler === undefined) throw new Error("Expected before-close listener registration.");
	await handler();
};

describe("Electron preload lifecycle", () => {
	beforeEach(() => {
		electron.reset();
		electron.contextBridge.exposeInMainWorld.mockClear();
		electron.ipcRenderer.invoke.mockReset();
		electron.ipcRenderer.on.mockClear();
		electron.ipcRenderer.send.mockReset();
	});

	it("shares one pending native close request", async () => {
		const api = await loadPreload();
		const first = api.lifecycle.requestClose();
		const second = api.lifecycle.requestClose();

		expect(second).toBe(first);
		expect(electron.ipcRenderer.send).toHaveBeenCalledTimes(1);
		expect(electron.ipcRenderer.send).toHaveBeenCalledWith(
			ArkiniDesktopContract.channels.requestClose,
		);
	});

	it("rejects failed close work and permits one truthful retry", async () => {
		const api = await loadPreload();
		const failure = new Error("save failed");
		api.lifecycle.onBeforeClose(() => Promise.reject(failure));
		const first = api.lifecycle.requestClose();

		await requestBeforeClose();
		await expect(first).rejects.toBe(failure);
		expect(electron.ipcRenderer.send).toHaveBeenCalledWith(
			ArkiniDesktopContract.channels.closeFailed,
			"Error: save failed",
		);

		const retry = api.lifecycle.requestClose();
		expect(retry).not.toBe(first);
		expect(electron.ipcRenderer.send).toHaveBeenCalledTimes(3);
		expect(electron.ipcRenderer.send).toHaveBeenLastCalledWith(
			ArkiniDesktopContract.channels.requestClose,
		);
	});

	it("signals native close readiness after every listener succeeds", async () => {
		const api = await loadPreload();
		const first = vi.fn(async () => undefined);
		const second = vi.fn(async () => undefined);
		api.lifecycle.onBeforeClose(first);
		api.lifecycle.onBeforeClose(second);
		api.lifecycle.requestClose();

		await requestBeforeClose();
		expect(first).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledOnce();
		expect(electron.ipcRenderer.send).toHaveBeenLastCalledWith(
			ArkiniDesktopContract.channels.closeReady,
		);
	});
});
