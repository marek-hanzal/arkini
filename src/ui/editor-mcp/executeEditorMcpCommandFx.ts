import { Effect } from "effect";
import { EditorMcpCommandResultSchema } from "../../../electron/contract/editor/EditorMcpCommandResultSchema";
import { EditorMcpCommandSchema } from "../../../electron/contract/editor/EditorMcpCommandSchema";

export type EditorMcpCommand = EditorMcpCommandSchema.Type;

export const executeEditorMcpCommandFx = Effect.fn("executeEditorMcpCommandFx")(
	(candidate: unknown) =>
		Effect.try({
			try: () => EditorMcpCommandSchema.parse(candidate),
			catch: (cause) => cause,
		}).pipe(
			Effect.flatMap((command) =>
				Effect.tryPromise({
					try: async () =>
						EditorMcpCommandResultSchema.parse(
							await window.arkini.editorMcp.command(command),
						),
					catch: (cause) => cause,
				}),
			),
		),
);
