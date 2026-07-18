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

const reportWindowVisible = () => {
	const handler = electron.handlers.get(ArkiniDesktopContract.channels.windowVisible);
	if (handler === undefined) throw new Error("Expected window-visible listener registration.");
	handler();
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
		const visible = api.lifecycle.waitUntilVisible();
		let settled = false;
		void visible.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		reportWindowVisible();
		const visibleAtMs = await visible;
		expect(visibleAtMs).toBeTypeOf("number");
		expect(await api.lifecycle.waitUntilVisible()).toBe(visibleAtMs);
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

	it("runs final save before presentation and resolves only before close readiness", async () => {
		const api = await loadPreload();
		const order: Array<string> = [];
		api.lifecycle.onBeforeClose(async () => {
			order.push("save");
		});
		api.lifecycle.onBeforeCloseReady(async () => {
			order.push("presentation");
		});
		const request = api.lifecycle.requestClose();

		await requestBeforeClose();
		await expect(request).resolves.toBeUndefined();
		expect(order).toEqual([
			"save",
			"presentation",
		]);
		expect(electron.ipcRenderer.send).toHaveBeenLastCalledWith(
			ArkiniDesktopContract.channels.closeReady,
		);
	});
});
