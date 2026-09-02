import { spawn } from "node:child_process";
import { Effect } from "effect";

import {
	EditorMcpHeadlessLaunchArgument,
	EditorMcpHeadlessRemoteArgument,
} from "~electron/contract/editor/EditorMcpHeadlessLaunch";

export namespace launchEditorMcpFx {
	export interface Props {
		readonly electronPath: string;
		readonly environment: NodeJS.ProcessEnv;
		readonly projectId: string;
		readonly remote: boolean;
	}
}

/** Starts the installed Arkini executable as a renderer-free Electron MCP process. */
export const launchEditorMcpFx = Effect.fn("launchEditorMcpFx")(function* ({
	electronPath,
	environment,
	projectId,
	remote,
}: launchEditorMcpFx.Props) {
	const childEnvironment = {
		...environment,
	};
	delete childEnvironment.ELECTRON_RUN_AS_NODE;
	const arguments_ = [
		EditorMcpHeadlessLaunchArgument,
		projectId,
		...(remote
			? [
					EditorMcpHeadlessRemoteArgument,
				]
			: []),
	];
	yield* Effect.callback<void, Error>((resumeFn) => {
		const child = spawn(electronPath, arguments_, {
			env: childEnvironment,
			stdio: "inherit",
		});
		let settled = false;
		const finishFn = (result: Effect.Effect<void, Error, never>) => {
			if (settled) return;
			settled = true;
			resumeFn(result);
		};
		child.once("error", (cause) => finishFn(Effect.fail(cause)));
		child.once("exit", (code, signal) =>
			finishFn(
				code === 0
					? Effect.void
					: Effect.fail(
							new Error(
								code === null
									? `Arkini Editor MCP stopped after ${signal ?? "an unknown signal"}.`
									: `Arkini Editor MCP exited with code ${code}.`,
							),
						),
			),
		);
		return Effect.sync(() => {
			if (!settled) child.kill("SIGTERM");
		});
	});
});
