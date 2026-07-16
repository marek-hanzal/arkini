import { BrowserWindow, screen } from "electron";
import { fileURLToPath } from "node:url";
import { calculateInitialWindowBounds } from "./calculateInitialWindowBounds";
import { registerFullscreenShortcuts } from "./registerFullscreenShortcuts";

export async function createMainWindow(): Promise<BrowserWindow> {
	const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
	const bounds = calculateInitialWindowBounds(display.workArea);
	const window = new BrowserWindow({
		...bounds,
		show: false,
		backgroundColor: "#0f172a",
		webPreferences: {
			preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	registerFullscreenShortcuts(window);
	window.webContents.setWindowOpenHandler(() => ({
		action: "deny",
	}));
	window.once("ready-to-show", () => window.show());

	if (process.env.ELECTRON_RENDERER_URL) {
		await window.loadURL(process.env.ELECTRON_RENDERER_URL);
		window.webContents.openDevTools({
			mode: "detach",
		});
	} else {
		await window.loadURL("arkini://app/");
	}

	return window;
}
