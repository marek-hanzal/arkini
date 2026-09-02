import { Argument, CliError, Command, Flag } from "effect/unstable/cli";
import { Effect } from "effect";

import { resolveArkiniUserDataPathsFx } from "~/application-data/fx/resolveArkiniUserDataPathsFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { createFilesystemEditorMcpOwnershipFx } from "~/authoring-mcp/fx/createFilesystemEditorMcpOwnershipFx";
import { createFilesystemEditorProjectRepositoryFx } from "~/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx";

const toUserErrorFn = (cause: unknown) =>
	new CliError.UserError({
		cause,
		userMessage: cause instanceof Error ? cause.message : "Arkini Editor MCP failed.",
	});

const runEditorMcpFx = Effect.fn("runEditorMcpFx")(function* ({
	projectId: candidate,
	remote,
}: {
	readonly projectId: string;
	readonly remote: boolean;
}) {
	const projectId = yield* Effect.try({
		try: () => IdSchema.parse(candidate),
		catch: (cause) => cause,
	});
	const userDataPaths = yield* resolveArkiniUserDataPathsFx;
	yield* Effect.scoped(
		Effect.gen(function* () {
			const repository = yield* Effect.acquireRelease(
				createFilesystemEditorProjectRepositoryFx({
					catalogPath: userDataPaths.editor.catalog,
					projectsRoot: userDataPaths.editor.projects,
				}),
				(repository) => repository.closeFx,
			);
			const project = yield* repository.readProjectFx(projectId);
			if (project === null)
				return yield* Effect.fail(new Error(`Editor project ${projectId} does not exist.`));
			const ownership = yield* Effect.acquireRelease(
				createFilesystemEditorMcpOwnershipFx({
					editor: {
						type: "ready",
						repository,
					},
					notifyOverviewChangedFn: () => undefined,
					notifyProjectChangedFn: () => undefined,
					root: userDataPaths.editor.root,
				}),
				(ownership) => ownership.closeFx.pipe(Effect.ignore),
			);
			yield* Effect.sync(() =>
				ownership.setProjectContextFn(projectId, (versionId) =>
					Effect.gen(function* () {
						yield* repository.awaitIdleFx;
						const status = yield* repository.readVersionStatusFx(projectId);
						yield* repository.checkoutVersionFx({
							expectedFingerprint: status.currentFingerprint,
							projectId,
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
			const remoteResult = remote ? yield* ownership.startRemoteFx : undefined;
			if (remoteResult !== undefined && remoteResult.overview.remote.type !== "ready")
				return yield* Effect.fail(
					new Error(
						remoteResult.overview.remote.type === "unavailable"
							? remoteResult.overview.remote.message
							: "Remote MCP did not become ready.",
					),
				);
			yield* Effect.sync(() =>
				console.log(
					[
						`Arkini Editor MCP is ready for project ${projectId}.`,
						`Local: http://127.0.0.1:${localPort}/editor/mcp`,
						...(remoteResult?.overview.remote.type === "ready"
							? [
									`Remote: ${remoteResult.overview.remote.url}`,
									`Remote password: ${remoteResult.overview.remotePassword}`,
								]
							: []),
						"Press Ctrl+C to stop.",
					].join("\n"),
				),
			);
			yield* Effect.never;
		}),
	);
});

/** Runs the selected Editor project's configured MCP server without opening a window. */
export const EditorMcpCommand = Command.make(
	"mcp",
	{
		projectId: Argument.string("projectId"),
		remote: Flag.boolean("remote").pipe(
			Flag.withDefault(false),
			Flag.withDescription("Also start the configured ngrok Remote MCP tunnel."),
		),
	},
	({ projectId, remote }) =>
		runEditorMcpFx({
			projectId,
			remote,
		}).pipe(Effect.mapError(toUserErrorFn)),
).pipe(
	Command.withDescription(
		"Start the selected Editor project's configured MCP server without opening the Editor.",
	),
);
