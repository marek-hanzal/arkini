import { app, BrowserWindow, protocol } from "electron";
import { fileURLToPath } from "node:url";
import { createMainWindow } from "./createMainWindow";
import { registerArkiniProtocol } from "./registerArkiniProtocol";
import { registerArkiniDesktopIpc } from "./registerArkiniDesktopIpc";
import { registerWindowLifecycle } from "./registerWindowLifecycle";

protocol.registerSchemesAsPrivileged([
	{
		scheme: "arkini",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			stream: true,
			codeCache: true,
		},
	},
]);

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		const window = BrowserWindow.getAllWindows()[0];
		if (!window) return;
		if (window.isMinimized()) window.restore();
		window.focus();
	});

	app.whenReady().then(async () => {
		const rendererRoot = fileURLToPath(new URL("../renderer", import.meta.url));
		await registerArkiniProtocol(rendererRoot);
		registerArkiniDesktopIpc();
		await createMainWindow();

		app.on("activate", async () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				await createMainWindow();
			}
		});
	});

	registerWindowLifecycle(app);
}
