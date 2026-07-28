import { app, protocol } from "electron";
import { electronMainFx } from "./electronMainFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";

if (!app.isPackaged && process.env.ARKINI_DEV_CONTROL === "1") {
	app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
	app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

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

void ElectronMainRuntime.runPromise(electronMainFx()).catch((error) => {
	console.error("Arkini Electron main failed.", error);
	app.quit();
});
