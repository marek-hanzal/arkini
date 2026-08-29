import type { BrowserWindow, WebContents } from "electron";
import { ipcMain, Menu } from "electron";
import { EventEmitter } from "node:events";
import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArkiniWindowTitle } from "../../shared/ArkiniAppMetadata";
import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { createMainWindowFx } from "../../electron/main/createMainWindowFx";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import { createChatGptViewControllerOwnershipFx } from "../../electron/main/chatgpt/createChatGptViewControllerOwnershipFx";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";
import { createWindowModeControllerOwnershipFx } from "../../electron/main/window/createWindowModeControllerOwnershipFx";
import type { WindowPreferences } from "../../electron/main/window/createFilesystemWindowPreferencesFx";

const electronState = vi.hoisted(() => ({
	loadFailure: new Error("renderer unavailable"),
	loadSucceeds: false,
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
		readonly getBounds = vi.fn(() => ({
			x: 0,
			y: 0,
			width: 1_200,
			height: 675,
		}));
		readonly isFullScreen = vi.fn(() => false);
		readonly loadURL = vi.fn(() =>
			electronState.loadSucceeds
				? Promise.resolve()
				: Promise.reject(electronState.loadFailure),
		);
		readonly maximize = vi.fn();
		readonly setFullScreen = vi.fn();
		readonly setBounds = vi.fn();
		readonly show = vi.fn();
		readonly unmaximize = vi.fn();
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
		Menu: {
			setApplicationMenu: vi.fn(),
		},
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
			getDisplayMatching: () => ({
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
	electronState.loadSucceeds = false;
	electronState.windows.length = 0;
	(ipcMain as unknown as EventEmitter).removeAllListeners();
});

const createTestMainWindowFx = Effect.fn("createTestMainWindowFx")(
	(
		props: Omit<
			createMainWindowFx.Props,
			"chatGptViewControllerOwnership" | "windowModeControllerOwnership"
		>,
	) =>
		Effect.gen(function* () {
			const chatGptViewControllerOwnership = yield* createChatGptViewControllerOwnershipFx();
			const windowModeControllerOwnership = yield* createWindowModeControllerOwnershipFx();
			return yield* createMainWindowFx({
				...props,
				chatGptViewControllerOwnership,
				windowModeControllerOwnership,
			});
		}),
);

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
		const windowPreferences: WindowPreferences = {
			readModeFx: Effect.succeed("bordered"),
			writeModeFx: () => Effect.void,
		};

		const exit = await Effect.runPromiseExit(
			createTestMainWindowFx({
				trustedRenderer,
				windowMode: "bordered",
				windowPreferences,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected renderer bootstrap failure.");
		expect(Cause.findErrorOption(exit.cause)).toEqual(
			Option.some(expect.any(ElectronMainError)),
		);

		const window = electronState.windows[0] as BrowserWindow & {
			readonly destroy: ReturnType<typeof vi.fn>;
			readonly options: {
				readonly fullscreen?: boolean;
				readonly fullscreenable?: boolean;
				readonly title?: string;
			};
			readonly maximize: ReturnType<typeof vi.fn>;
			readonly show: ReturnType<typeof vi.fn>;
			readonly webContents: WebContents;
		};
		expect(window.options.title).toBe(ArkiniWindowTitle);
		expect(window.options.fullscreen).toBe(false);
		expect(window.options.fullscreenable).toBe(true);
		expect(Menu.setApplicationMenu).toHaveBeenLastCalledWith(null);
		expect(window.maximize).toHaveBeenCalledOnce();
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

	it("restores exclusive fullscreen without maximizing the bordered shell", async () => {
		const trustedRenderer = {
			developmentRendererUrl: undefined,
			isTrustedIpcSender: () => false,
			registerWindowFx: () => Effect.void,
		} as unknown as TrustedRenderer;
		const windowPreferences: WindowPreferences = {
			readModeFx: Effect.succeed("fullscreen"),
			writeModeFx: () => Effect.void,
		};

		await Effect.runPromiseExit(
			createTestMainWindowFx({
				trustedRenderer,
				windowMode: "fullscreen",
				windowPreferences,
			}),
		);

		const window = electronState.windows[0] as BrowserWindow & {
			readonly options: {
				readonly fullscreen?: boolean;
			};
			readonly maximize: ReturnType<typeof vi.fn>;
		};
		expect(window.options.fullscreen).toBe(true);
		expect(window.maximize).not.toHaveBeenCalled();
	});

	it("keeps the canonical default window at its calculated bounds", async () => {
		electronState.loadSucceeds = true;
		const trustedRenderer = {
			developmentRendererUrl: undefined,
			isTrustedIpcSender: () => false,
			registerWindowFx: () => Effect.void,
		} as unknown as TrustedRenderer;
		const windowPreferences: WindowPreferences = {
			readModeFx: Effect.succeed("default"),
			writeModeFx: () => Effect.void,
		};

		await Effect.runPromise(
			createTestMainWindowFx({
				trustedRenderer,
				windowMode: "default",
				windowPreferences,
			}),
		);

		const window = electronState.windows[0] as BrowserWindow & {
			readonly emit: (event: string) => boolean;
			readonly maximize: ReturnType<typeof vi.fn>;
			readonly show: ReturnType<typeof vi.fn>;
			readonly options: {
				readonly fullscreen?: boolean;
				readonly height?: number;
				readonly width?: number;
			};
		};
		window.emit("ready-to-show");
		expect(window.options).toMatchObject({
			fullscreen: false,
			width: 1_200,
			height: 675,
		});
		expect(window.maximize).not.toHaveBeenCalled();
		expect(window.show).toHaveBeenCalledOnce();
		expect(window.webContents.send).toHaveBeenCalledWith(
			ArkiniElectronApi.channels.windowVisible,
		);
		expect(window.show.mock.invocationCallOrder[0]).toBeLessThan(
			(window.webContents.send as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? 0,
		);
	});
});
