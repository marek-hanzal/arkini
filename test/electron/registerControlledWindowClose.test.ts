import type { BrowserWindow, IpcMain, IpcMainEvent } from "electron";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { registerControlledWindowCloseFx } from "../../electron/main/registerControlledWindowCloseFx";

type CloseListener = (event: { preventDefault(): void }) => void;
type IpcListener = (event: IpcMainEvent, ...args: unknown[]) => void;

const createHarness = () => {
	const windowListeners = new Map<string, (...args: never[]) => void>();
	const webContentsListeners = new Map<string, (...args: never[]) => void>();
	const ipcListeners = new Map<string, Set<IpcListener>>();
	const send = vi.fn();
	const close = vi.fn();
	const destroy = vi.fn();
	const window = {
		close,
		destroy,
		isDestroyed: () => false,
		on: (event: string, listener: (...args: never[]) => void) => {
			windowListeners.set(event, listener);
			return window;
		},
		once: (event: string, listener: (...args: never[]) => void) => {
			windowListeners.set(event, listener);
			return window;
		},
		webContents: {
			id: 17,
			isDestroyed: () => false,
			once: (event: string, listener: (...args: never[]) => void) => {
				webContentsListeners.set(event, listener);
			},
			send,
		},
	} as unknown as BrowserWindow;
	const ipc = {
		on: (channel: string, listener: IpcListener) => {
			const listeners = ipcListeners.get(channel) ?? new Set<IpcListener>();
			listeners.add(listener);
			ipcListeners.set(channel, listeners);
			return ipc;
		},
		removeListener: (channel: string, listener: IpcListener) => {
			ipcListeners.get(channel)?.delete(listener);
			return ipc;
		},
	} as unknown as Pick<IpcMain, "on" | "removeListener">;

	Effect.runSync(
		registerControlledWindowCloseFx({
			window,
			ipc,
		}),
	);
	const emitIpc = (channel: string, ...args: unknown[]) => {
		const event = {
			sender: {
				id: 17,
			},
		} as IpcMainEvent;
		for (const listener of ipcListeners.get(channel) ?? []) listener(event, ...args);
	};
	const requestClose = () => {
		const preventDefault = vi.fn();
		(windowListeners.get("close") as CloseListener | undefined)?.({
			preventDefault,
		});
		return preventDefault;
	};
	const emitWebContents = (event: string) => {
		webContentsListeners.get(event)?.();
	};

	return {
		close,
		destroy,
		emitIpc,
		emitWebContents,
		requestClose,
		send,
	};
};

describe("registerControlledWindowCloseFx", () => {
	it("allows the window to close only after the renderer confirms a successful final flush", () => {
		const harness = createHarness();
		const preventDefault = harness.requestClose();

		expect(preventDefault).toHaveBeenCalledOnce();
		expect(harness.send).toHaveBeenCalledWith(ArkiniDesktopApi.channels.beforeClose);
		expect(harness.close).not.toHaveBeenCalled();

		harness.emitIpc(ArkiniDesktopApi.channels.closeReady);
		expect(harness.close).toHaveBeenCalledOnce();
		const recursiveClose = harness.requestClose();
		expect(recursiveClose).not.toHaveBeenCalled();
	});

	it("keeps the window open after a failed final save and permits an explicit retry", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const harness = createHarness();
		harness.requestClose();
		harness.emitIpc(ArkiniDesktopApi.channels.closeFailed, "disk full");

		expect(harness.close).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			"Arkini renderer refused to close after a failed final save:",
			"disk full",
		);

		harness.requestClose();
		expect(harness.send).toHaveBeenCalledTimes(2);
		harness.emitIpc(ArkiniDesktopApi.channels.closeReady);
		expect(harness.close).toHaveBeenCalledOnce();
	});
	it("routes an explicit renderer retry through the same guarded close handshake", () => {
		const harness = createHarness();
		harness.emitIpc(ArkiniDesktopApi.channels.requestClose);
		expect(harness.close).toHaveBeenCalledOnce();

		const preventDefault = harness.requestClose();
		expect(preventDefault).toHaveBeenCalledOnce();
		expect(harness.send).toHaveBeenCalledWith(ArkiniDesktopApi.channels.beforeClose);
	});

	it("allows an explicit force-close decision without another save acknowledgement", () => {
		const harness = createHarness();
		harness.requestClose();
		harness.emitIpc(ArkiniDesktopApi.channels.closeFailed, "disk full");

		harness.emitIpc(ArkiniDesktopApi.channels.forceClose);
		expect(harness.close).toHaveBeenCalledOnce();
		const preventDefault = harness.requestClose();
		expect(preventDefault).not.toHaveBeenCalled();
	});
	it("distinguishes renderer crash from an acknowledged clean close", () => {
		const harness = createHarness();
		harness.requestClose();

		harness.emitWebContents("render-process-gone");
		expect(harness.destroy).toHaveBeenCalledOnce();
		expect(harness.close).not.toHaveBeenCalled();
	});
});
