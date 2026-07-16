import type { BrowserWindow } from "electron";
import { describe, expect, it, vi } from "vitest";
import { registerFullscreenShortcuts } from "../../electron/main/registerFullscreenShortcuts";

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

const createWindow = () => {
	let listener: BeforeInputListener | undefined;
	const setFullScreen = vi.fn();
	const isFullScreen = vi.fn(() => false);
	const window = {
		webContents: {
			on: (event: string, nextListener: BeforeInputListener) => {
				if (event === "before-input-event") listener = nextListener;
			},
		},
		isFullScreen,
		setFullScreen,
	} as unknown as BrowserWindow;

	registerFullscreenShortcuts(window);
	return {
		getListener: () => listener,
		isFullScreen,
		setFullScreen,
	};
};

describe("registerFullscreenShortcuts", () => {
	it.each([
		{
			key: "F11",
			alt: false,
		},
		{
			key: "Enter",
			alt: true,
		},
	])("toggles native fullscreen for $key", ({ key, alt }) => {
		const { getListener, setFullScreen } = createWindow();
		const preventDefault = vi.fn();

		getListener()?.(
			{
				preventDefault,
			},
			{
				type: "keyDown",
				key,
				alt,
				isAutoRepeat: false,
			},
		);

		expect(preventDefault).toHaveBeenCalledOnce();
		expect(setFullScreen).toHaveBeenCalledWith(true);
	});

	it("leaves fullscreen when the window is already fullscreen", () => {
		const { getListener, isFullScreen, setFullScreen } = createWindow();
		isFullScreen.mockReturnValue(true);

		getListener()?.(
			{
				preventDefault: vi.fn(),
			},
			{
				type: "keyDown",
				key: "F11",
				alt: false,
				isAutoRepeat: false,
			},
		);

		expect(setFullScreen).toHaveBeenCalledWith(false);
	});

	it("ignores keyup, repeats, and unrelated shortcuts", () => {
		const { getListener, setFullScreen } = createWindow();
		const event = {
			preventDefault: vi.fn(),
		};

		getListener()?.(event, {
			type: "keyUp",
			key: "F11",
			alt: false,
			isAutoRepeat: false,
		});
		getListener()?.(event, {
			type: "keyDown",
			key: "F11",
			alt: false,
			isAutoRepeat: true,
		});
		getListener()?.(event, {
			type: "keyDown",
			key: "Enter",
			alt: false,
			isAutoRepeat: false,
		});

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(setFullScreen).not.toHaveBeenCalled();
	});
});
