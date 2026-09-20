import { app, protocol } from "electron";
import { electronMainFx } from "./electronMainFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { writeFatalApplicationLogFx } from "./diagnostics/writeFatalApplicationLogFx";
import { resolveSerakkiUserDataPathsFx } from "~/application-data/fx/resolveSerakkiUserDataPathsFx";

if (!app.isPackaged && process.env.SERAKKI_DEV_CONTROL === "1") {
	app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
	app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

protocol.registerSchemesAsPrivileged([
	{
		scheme: "serakki",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true,
			stream: true,
			codeCache: true,
		},
	},
]);

void ElectronMainRuntime.runPromise(electronMainFx()).catch(async (error) => {
	console.error("Serakki Electron main failed.", error);
	try {
		const userDataPaths = await ElectronMainRuntime.runPromise(resolveSerakkiUserDataPathsFx);
		await ElectronMainRuntime.runPromise(
			writeFatalApplicationLogFx({
				directoryPath: userDataPaths.diagnostics,
				error,
			}),
		);
	} catch (diagnosticError) {
		console.error("Serakki could not record the fatal application error.", diagnosticError);
	}
	app.quit();
});
