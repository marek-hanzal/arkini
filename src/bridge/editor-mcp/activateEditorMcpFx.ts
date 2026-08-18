import { Effect } from "effect";

/** Lazily starts MCP on first editor entry; MCP failure never blocks the editor UI. */
export const activateEditorMcpFx = Effect.tryPromise({
	try: () => window.arkini.editorMcp.activate(),
	catch: (cause) => cause,
}).pipe(
	Effect.catch(() =>
		Effect.succeed({
			type: "unavailable" as const,
			message: "The editor MCP service did not respond.",
		}),
	),
);
