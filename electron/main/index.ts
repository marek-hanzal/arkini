import { app, protocol } from "electron";
import { Effect, FileSystem, Path } from "effect";
import { EditorMcpHeadlessLaunchArgument } from "../contract/editor/EditorMcpHeadlessLaunch";
import { electronMainFx } from "./electronMainFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { writeFatalApplicationLogFx } from "./diagnostics/writeFatalApplicationLogFx";
import { runHeadlessEditorMcpFx } from "./editor-mcp/runHeadlessEditorMcpFx";
import { createArkiniUserDataPathsFn } from "./user-data/fn/createArkiniUserDataPathsFn";

const runElectronMainFn = (
	label: string,
	program: Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>,
	failureExitCode?: number,
) => {
	void ElectronMainRuntime.runPromise(program).catch(async (error) => {
		console.error(`${label} failed.`, error);
		try {
			await ElectronMainRuntime.runPromise(
				writeFatalApplicationLogFx({
					directoryPath: createArkiniUserDataPathsFn(app.getPath("userData")).diagnostics,
					error,
				}),
			);
		} catch (diagnosticError) {
			console.error("Arkini could not record the fatal application error.", diagnosticError);
		}
		if (failureExitCode === undefined) app.quit();
		else app.exit(failureExitCode);
	});
};

const headlessArgumentIndex = process.argv.indexOf(EditorMcpHeadlessLaunchArgument);
if (headlessArgumentIndex >= 0) {
	app.commandLine.appendSwitch("headless");
	app.disableHardwareAcceleration();
	runElectronMainFn(
		"Arkini headless Editor MCP",
		runHeadlessEditorMcpFx({
			arguments: process.argv.slice(headlessArgumentIndex + 1),
		}),
		1,
	);
} else {
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

	runElectronMainFn("Arkini Electron main", electronMainFx());
}
