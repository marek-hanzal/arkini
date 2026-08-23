import { vi } from "vitest";

const electronHarness = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
	const appListeners = new Map<string, () => void>();
	const nativeThemeListeners = new Map<string, () => void>();
	const setBackgroundColor = vi.fn();
	const requestWindowMode = vi.fn();
	const openPath = vi.fn(() => Promise.resolve(""));
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
		requestWindowMode,
		setBackgroundColor,
		userDataPath,
		module: {
			app: {
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
