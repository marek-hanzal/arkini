import { vi } from "vitest";

const electronHarness = vi.hoisted(() => {
	const relaunch = vi.fn();
	const exit = vi.fn();
	const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
	const appListeners = new Map<string, () => void>();
	const requestWindowMode = vi.fn();
	const openPath = vi.fn(() => Promise.resolve(""));
	const writeClipboardText = vi.fn(() => Promise.resolve());
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
	return {
		relaunch,
		exit,
		appListeners,
		browserWindow,
		handlers,
		openPath,
		preferredSystemLanguages,
		requestWindowMode,
		userDataPath,
		writeClipboardText,
		module: {
			app: {
				relaunch,
				exit,
				getPreferredSystemLanguages: () => preferredSystemLanguages.value,
				getPath: () => userDataPath.value,
				once: (event: string, listener: () => void) => {
					appListeners.set(event, listener);
				},
			},
			BrowserWindow: {
				fromWebContents: () => browserWindow,
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
			shell: {
				openPath,
			},
		},
	};
});

vi.mock("electron", () => electronHarness.module);

export const readElectronHarness = () => electronHarness;
