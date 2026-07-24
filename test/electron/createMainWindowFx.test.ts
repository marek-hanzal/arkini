import type { BrowserWindow, WebContents } from "electron";
import { ipcMain } from "electron";
import { EventEmitter } from "node:events";
import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { createMainWindowFx } from "../../electron/main/createMainWindowFx";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";

const electronState = vi.hoisted(() => ({
	loadFailure: new Error("renderer unavailable"),
	windows: [] as Array<unknown>,
}));

vi.mock("electron", async () => {
	const { EventEmitter } = await import("node:events");
	const ipc = new EventEmitter();

	class TestWebContents extends EventEmitter {
		readonly id = 17;
		readonly mainFrame = {
			url: "arkini://app/",
		};
		private destroyed = false;
		readonly openDevTools = vi.fn();
		readonly send = vi.fn();

		isDestroyed() {
			return this.destroyed;
		}

		markDestroyed() {
			this.destroyed = true;
			this.removeAllListeners();
		}
	}

	class TestBrowserWindow extends EventEmitter {
		readonly close = vi.fn();
		readonly destroy = vi.fn(() => {
			if (this.destroyed) return;
			this.destroyed = true;
			this.webContents.markDestroyed();
			this.emit("closed");
			this.removeAllListeners();
		});
		private destroyed = false;
		readonly isFullScreen = vi.fn(() => false);
		readonly loadURL = vi.fn(() => Promise.reject(electronState.loadFailure));
		readonly setFullScreen = vi.fn();
		readonly show = vi.fn();
		readonly webContents = new TestWebContents();

		constructor(readonly options: unknown) {
			super();
			electronState.windows.push(this);
		}

		isDestroyed() {
			return this.destroyed;
		}
	}

	return {
		BrowserWindow: TestBrowserWindow,
		ipcMain: ipc,
		screen: {
			getCursorScreenPoint: () => ({
				x: 0,
				y: 0,
			}),
			getDisplayNearestPoint: () => ({
				workArea: {
					x: 0,
					y: 0,
					width: 1_600,
					height: 900,
				},
			}),
		},
	};
});

beforeEach(() => {
	electronState.windows.length = 0;
	(ipcMain as unknown as EventEmitter).removeAllListeners();
});

describe("createMainWindowFx", () => {
	it("destroys a failed hidden window and releases its lifecycle listeners", async () => {
		const trustedWindowRemoved = vi.fn();
		const trustedRenderer = {
			developmentRendererUrl: undefined,
			isTrustedIpcSender: () => false,
			registerWindowFx: (window: BrowserWindow) =>
				Effect.sync(() => {
					window.once("closed", trustedWindowRemoved);
				}),
		} as unknown as TrustedRenderer;

		const exit = await Effect.runPromiseExit(
			createMainWindowFx({
				trustedRenderer,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected renderer bootstrap failure.");
		expect(Cause.findErrorOption(exit.cause)).toEqual(
			Option.some(expect.any(ElectronMainError)),
		);

		const window = electronState.windows[0] as BrowserWindow & {
			readonly destroy: ReturnType<typeof vi.fn>;
			readonly show: ReturnType<typeof vi.fn>;
			readonly webContents: WebContents;
		};
		expect(window.destroy).toHaveBeenCalledOnce();
		expect(window.isDestroyed()).toBe(true);
		expect(window.show).not.toHaveBeenCalled();
		expect(trustedWindowRemoved).toHaveBeenCalledOnce();
		expect(
			(ipcMain as unknown as EventEmitter).listenerCount(
				ArkiniElectronApi.channels.requestClose,
			),
		).toBe(0);
		expect(
			(ipcMain as unknown as EventEmitter).listenerCount(
				ArkiniElectronApi.channels.forceClose,
			),
		).toBe(0);
		expect(window.listenerCount("ready-to-show")).toBe(0);
	});
});
