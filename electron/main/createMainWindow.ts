import { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";

export async function createMainWindow(): Promise<BrowserWindow> {
	const window = new BrowserWindow({
		width: 1280,
		height: 900,
		minWidth: 720,
		minHeight: 640,
		show: false,
		backgroundColor: "#0f172a",
		webPreferences: {
			preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

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
