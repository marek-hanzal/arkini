import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import { EventEmitter } from "node:events";
import { vi } from "vitest";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { createWindowModeControllerFx } from "~electron/main/window/createWindowModeControllerFx";
import type { WindowPreferences } from "~electron/main/window/createFilesystemWindowPreferencesFx";

type BeforeInputListener = (
	event: {
		preventDefault(): void;
	},
	input: {
		readonly type: string;
		readonly key: string;
		readonly alt: boolean;
		readonly isAutoRepeat: boolean;
	},
) => void;

export const createHarness = (
	initialMode: WindowModeSchema.Type,
	{
		deferFullscreenStateUntilEvent = false,
		fullscreen = initialMode === "fullscreen",
		writeModeFx,
	}: {
		readonly deferFullscreenStateUntilEvent?: boolean;
		readonly fullscreen?: boolean;
		readonly writeModeFx?: WindowPreferences["writeModeFx"];
	} = {},
) => {
	const windowEvents = new EventEmitter();
	const webContentsEvents = new EventEmitter();
	let isFullscreen = fullscreen;
	let isMaximized = initialMode === "bordered";
	const maximize = vi.fn(() => {
		isMaximized = true;
	});
	const unmaximize = vi.fn(() => {
		isMaximized = false;
	});
	const setBounds = vi.fn();
	const send = vi.fn();
	const writes: WindowModeSchema.Type[] = [];
	const windowPreferences: WindowPreferences = {
		readModeFx: Effect.succeed(initialMode),
		writeModeFx:
			writeModeFx ??
			((mode) =>
				Effect.sync(() => {
					writes.push(mode);
				})),
	};
	const window = Object.assign(windowEvents, {
		getBounds: () => ({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
		}),
		isFullScreen: () => isFullscreen,
		isMaximized: () => isMaximized,
		maximize,
		setBounds,
		setFullScreen: vi.fn((next: boolean) => {
			if (!deferFullscreenStateUntilEvent) isFullscreen = next;
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
		emit: (event: string) => {
			if (event === "enter-full-screen") isFullscreen = true;
			if (event === "leave-full-screen") isFullscreen = false;
			if (event === "maximize") isMaximized = true;
			if (event === "unmaximize") isMaximized = false;
			return windowEvents.emit(event);
		},
		emitWithoutStateChange: (event: string) => windowEvents.emit(event),
		getShortcutListener: () =>
			webContentsEvents.listeners("before-input-event")[0] as BeforeInputListener | undefined,
		isMaximized: () => isMaximized,
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
