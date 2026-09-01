import { vi } from "vitest";

const electronHarness = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
	const appListeners = new Map<string, () => void>();
	const nativeThemeListeners = new Map<string, () => void>();
	const setBackgroundColor = vi.fn();
	const requestWindowMode = vi.fn();
	const openPath = vi.fn(() => Promise.resolve(""));
	const writeClipboardText = vi.fn();
	const preferredSystemLanguages = {
		value: [
			"cs-CZ",
			"en-GB",
		] as ReadonlyArray<string>,
	};
	const browserWindow = {
		once: vi.fn(),
	};
	const userDataPath = {
		value: "",
	};
	const nativeTheme = {
		on: (event: string, listener: () => void) => {
			nativeThemeListeners.set(event, listener);
		},
		removeListener: (event: string) => {
			nativeThemeListeners.delete(event);
		},
		shouldUseDarkColors: true,
		themeSource: "dark",
	};
	return {
		appListeners,
		browserWindow,
		handlers,
		nativeTheme,
		nativeThemeListeners,
		openPath,
		preferredSystemLanguages,
		requestWindowMode,
		setBackgroundColor,
		userDataPath,
		writeClipboardText,
		module: {
			app: {
				getPreferredSystemLanguages: () => preferredSystemLanguages.value,
				getPath: () => userDataPath.value,
				once: (event: string, listener: () => void) => {
					appListeners.set(event, listener);
				},
			},
			BrowserWindow: {
				fromWebContents: () => browserWindow,
				getAllWindows: () => [
					{
						setBackgroundColor,
					},
				],
			},
			clipboard: {
				writeText: writeClipboardText,
			},
			ipcMain: {
				handle: (
					channel: string,
					listener: (event: unknown, ...args: unknown[]) => unknown,
				) => handlers.set(channel, listener),
				removeHandler: (channel: string) => handlers.delete(channel),
			},
			nativeTheme,
			shell: {
				openPath,
			},
		},
	};
});

vi.mock("electron", () => electronHarness.module);

export const readElectronHarness = () => electronHarness;
