import { app, protocol } from "electron";
import { electronMainFx } from "./electronMainFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { writeFatalApplicationLogFx } from "./diagnostics/writeFatalApplicationLogFx";
import { resolveArkiniUserDataPathsFx } from "~/application-data/fx/resolveArkiniUserDataPathsFx";

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

void ElectronMainRuntime.runPromise(electronMainFx()).catch(async (error) => {
	console.error("Arkini Electron main failed.", error);
	try {
		const userDataPaths = await ElectronMainRuntime.runPromise(resolveArkiniUserDataPathsFx);
		await ElectronMainRuntime.runPromise(
			writeFatalApplicationLogFx({
				directoryPath: userDataPaths.diagnostics,
				error,
			}),
		);
	} catch (diagnosticError) {
		console.error("Arkini could not record the fatal application error.", diagnosticError);
	}
	app.quit();
});
