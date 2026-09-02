import { Argument, CliError, Command, Flag } from "effect/unstable/cli";
import { Effect } from "effect";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { launchEditorMcpFx } from "~/arkini-cli/fx/launchEditorMcpFx";

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
	yield* launchEditorMcpFx({
		electronPath: process.execPath,
		environment: process.env,
		projectId,
		remote,
	});
});

/** Runs the selected Editor project's configured MCP server without opening a window. */
export const EditorMcpCommand = Command.make(
	"mcp",
	{
		projectId: Argument.string("projectId"),
		remote: Flag.boolean("remote").pipe(
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
