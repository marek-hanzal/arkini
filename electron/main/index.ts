import { app, protocol } from "electron";
import { electronMainFx } from "./electronMainFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";

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
