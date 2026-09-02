import { app, type Event as ElectronEvent } from "electron";
import { Effect } from "effect";

import { EditorMcpHeadlessRemoteArgument } from "~electron/contract/editor/EditorMcpHeadlessLaunch";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import { createFilesystemEditorProjectRepositoryFx } from "~electron/main/editor-project/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import { createArkiniUserDataPathsFn } from "~electron/main/user-data/fn/createArkiniUserDataPathsFn";
import { createFilesystemEditorMcpOwnershipFx } from "./createFilesystemEditorMcpOwnershipFx";

interface LaunchConfiguration {
	readonly projectId: string;
	readonly remote: boolean;
}

const readLaunchConfigurationFn = (
	arguments_: ReadonlyArray<string>,
): LaunchConfiguration | Error => {
	const [candidate, ...rest] = arguments_;
	const parsed = IdSchema.safeParse(candidate);
	if (!parsed.success) return new Error("Arkini Editor MCP requires one project ID.");
	if (rest.length === 0)
		return {
			projectId: parsed.data,
			remote: false,
		};
	if (rest.length === 1 && rest[0] === EditorMcpHeadlessRemoteArgument)
		return {
			projectId: parsed.data,
			remote: true,
		};
	return new Error("Arkini Editor MCP received invalid internal launch arguments.");
};

const waitForExitFx = Effect.callback<void>((resumeFn) => {
	let settled = false;
	const removeListenersFn = () => {
		process.off("SIGINT", finishFn);
		process.off("SIGTERM", finishFn);
		app.off("before-quit", onBeforeQuitFn);
	};
	const finishFn = () => {
		if (settled) return;
		settled = true;
		removeListenersFn();
		resumeFn(Effect.void);
	};
	const onBeforeQuitFn = (event: ElectronEvent) => {
		event.preventDefault();
		finishFn();
	};
	process.on("SIGINT", finishFn);
	process.on("SIGTERM", finishFn);
	app.on("before-quit", onBeforeQuitFn);
	return Effect.sync(removeListenersFn);
});

export namespace runHeadlessEditorMcpFx {
	export interface Props {
		readonly arguments: ReadonlyArray<string>;
	}
}

/** Runs the installed Editor repository and MCP ownership without a renderer or window. */
export const runHeadlessEditorMcpFx = Effect.fn("runHeadlessEditorMcpFx")(function* ({
	arguments: arguments_,
}: runHeadlessEditorMcpFx.Props) {
	const configuration = readLaunchConfigurationFn(arguments_);
	if (configuration instanceof Error) return yield* Effect.fail(configuration);
	yield* Effect.promise(() => app.whenReady());
	const userDataPaths = createArkiniUserDataPathsFn(app.getPath("userData"));
	yield* Effect.acquireUseRelease(
		createFilesystemEditorProjectRepositoryFx({
			catalogPath: userDataPaths.editor.catalog,
			projectsRoot: userDataPaths.editor.projects,
		}),
		(repository) =>
			Effect.gen(function* () {
				const project = yield* repository.readProjectFx(configuration.projectId);
				if (project === null)
					return yield* Effect.fail(
						new Error(`Editor project ${configuration.projectId} does not exist.`),
					);
				yield* Effect.acquireUseRelease(
					createFilesystemEditorMcpOwnershipFx({
						editor: {
							type: "ready",
							repository,
						},
						notifyOverviewChangedFn: () => undefined,
						notifyProjectChangedFn: () => undefined,
						root: userDataPaths.editor.root,
						runPromiseFn: ElectronMainRuntime.runPromise,
					}),
					(ownership) =>
						Effect.gen(function* () {
							yield* Effect.sync(() =>
								ownership.setProjectContextFn(
									configuration.projectId,
									(versionId) =>
										Effect.gen(function* () {
											yield* repository.awaitIdleFx;
											const status = yield* repository.readVersionStatusFx(
												configuration.projectId,
											);
											yield* repository.checkoutVersionFx({
												expectedFingerprint: status.currentFingerprint,
												projectId: configuration.projectId,
												versionId,
											});
										}),
								),
							);
							const local = yield* ownership.startLocalFx;
							if (local.overview.local.type !== "ready")
								return yield* Effect.fail(
									new Error(
										local.overview.local.type === "unavailable"
											? local.overview.local.message
											: "Local MCP did not become ready.",
									),
								);
							const localPort = local.overview.local.port;
							const remote = configuration.remote
								? yield* ownership.startRemoteFx
								: undefined;
							if (remote !== undefined && remote.overview.remote.type !== "ready")
								return yield* Effect.fail(
									new Error(
										remote.overview.remote.type === "unavailable"
											? remote.overview.remote.message
											: "Remote MCP did not become ready.",
									),
								);
							yield* Effect.sync(() =>
								console.log(
									[
										`Arkini Editor MCP is ready for project ${configuration.projectId}.`,
										`Local: http://127.0.0.1:${localPort}/editor/mcp`,
										...(remote?.overview.remote.type === "ready"
											? [
													`Remote: ${remote.overview.remote.url}`,
													`Remote password: ${remote.overview.remotePassword}`,
												]
											: []),
										"Press Ctrl+C to stop.",
									].join("\n"),
								),
							);
							yield* waitForExitFx;
						}),
					(ownership) => ownership.closeFx,
				);
			}),
		(repository) => repository.closeFx,
	);
	yield* Effect.sync(() => app.quit());
});
