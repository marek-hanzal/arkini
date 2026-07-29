import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import type { WindowModeSchema } from "../../electron/contract/window/WindowModeSchema";
import { createWindowModeControllerFx } from "../../electron/main/window/createWindowModeControllerFx";
import type { WindowPreferences } from "../../electron/main/window/WindowPreferences";

const electronState = vi.hoisted(() => ({
	workArea: {
		x: 100,
		y: 50,
		width: 1_600,
		height: 1_000,
	},
}));

vi.mock("electron", () => ({
	screen: {
		getDisplayMatching: () => ({
			workArea: electronState.workArea,
		}),
	},
}));

type BeforeInputListener = (
	event: {
		preventDefault(): void;
	},
	input: {
		type: string;
		key: string;
		alt: boolean;
		isAutoRepeat: boolean;
	},
) => void;

const createHarness = (
	initialMode: WindowModeSchema.Type,
	{
		fullscreen = initialMode === "fullscreen",
	}: {
		readonly fullscreen?: boolean;
	} = {},
) => {
	const windowEvents = new EventEmitter();
	const webContentsEvents = new EventEmitter();
	let isFullscreen = fullscreen;
	const maximize = vi.fn();
	const unmaximize = vi.fn();
	const setBounds = vi.fn();
	const send = vi.fn();
	const writes: WindowModeSchema.Type[] = [];
	const windowPreferences: WindowPreferences = {
		readModeFx: Effect.succeed(initialMode),
		writeModeFx: (mode) =>
			Effect.sync(() => {
				writes.push(mode);
			}),
	};
	const window = Object.assign(windowEvents, {
		getBounds: () => ({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
		}),
		isFullScreen: () => isFullscreen,
		maximize,
		setBounds,
		setFullScreen: vi.fn((next: boolean) => {
			isFullscreen = next;
		}),
		unmaximize,
		webContents: Object.assign(webContentsEvents, {
			isDestroyed: () => false,
			send,
		}),
	}) as unknown as BrowserWindow;
	const controller = Effect.runSync(
		createWindowModeControllerFx({
			initialMode,
			window,
			windowPreferences,
		}),
	);

	return {
		controller,
		emit: (event: string) => windowEvents.emit(event),
		getShortcutListener: () =>
			webContentsEvents.listeners("before-input-event")[0] as BeforeInputListener | undefined,
		maximize,
		send,
		setBounds,
		setFullScreen: (
			window as unknown as {
				readonly setFullScreen: ReturnType<typeof vi.fn>;
			}
		).setFullScreen,
		unmaximize,
		writes,
	};
};

describe("createWindowModeControllerFx", () => {
	it("waits for Electron to confirm exclusive fullscreen before completing", async () => {
		const harness = createHarness("default");
		let completed = false;
		const request = Effect.runPromise(harness.controller.requestModeFx("fullscreen")).then(
			() => {
				completed = true;
			},
		);

		expect(harness.setFullScreen).toHaveBeenCalledWith(true);
		expect(completed).toBe(false);
		harness.emit("enter-full-screen");
		await request;

		expect(harness.writes).toEqual([
			"fullscreen",
		]);
		expect(harness.send).toHaveBeenCalledWith(
			ArkiniElectronApi.channels.windowModeChanged,
			"fullscreen",
		);
	});

	it("restores canonical default bounds after leaving fullscreen", async () => {
		const harness = createHarness("fullscreen");
		const request = Effect.runPromise(harness.controller.requestModeFx("default"));

		expect(harness.setFullScreen).toHaveBeenCalledWith(false);
		harness.emit("leave-full-screen");
		await request;

		expect(harness.unmaximize).toHaveBeenCalledOnce();
		expect(harness.setBounds).toHaveBeenCalledWith({
			x: 300,
			y: 175,
			width: 1_200,
			height: 750,
		});
		expect(harness.writes).toEqual([
			"default",
		]);
	});

	it("maximizes bordered mode and records native maximize changes", async () => {
		const harness = createHarness("default");

		await Effect.runPromise(harness.controller.requestModeFx("bordered"));
		expect(harness.maximize).toHaveBeenCalledOnce();
		expect(harness.writes).toEqual([
			"bordered",
		]);

		harness.emit("unmaximize");
		await vi.waitFor(() =>
			expect(harness.writes).toEqual([
				"bordered",
				"default",
			]),
		);
	});

	it("toggles fullscreen through F11 and returns to the prior windowed mode", async () => {
		const harness = createHarness("bordered");
		const preventDefault = vi.fn();

		harness.getShortcutListener()?.(
			{
				preventDefault,
			},
			{
				type: "keyDown",
				key: "F11",
				alt: false,
				isAutoRepeat: false,
			},
		);
		expect(preventDefault).toHaveBeenCalledOnce();
		expect(harness.setFullScreen).toHaveBeenCalledWith(true);
		harness.emit("enter-full-screen");
		await vi.waitFor(() => expect(harness.writes).toContain("fullscreen"));

		harness.getShortcutListener()?.(
			{
				preventDefault,
			},
			{
				type: "keyDown",
				key: "F11",
				alt: false,
				isAutoRepeat: false,
			},
		);
		expect(harness.setFullScreen).toHaveBeenLastCalledWith(false);
		harness.emit("leave-full-screen");
		await vi.waitFor(() => expect(harness.writes.at(-1)).toBe("bordered"));
	});
});
