import { Effect } from "effect";
import { EditorMcpConfigurationSchema } from "../../../electron/contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

export const configureEditorMcpFx = Effect.fn("configureEditorMcpFx")((candidate: unknown) =>
	Effect.try({
		try: () => EditorMcpConfigurationSchema.parse(candidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((configuration) =>
			Effect.tryPromise({
				try: async () =>
					EditorMcpOverviewSchema.parse(
						await window.arkini.editorMcp.configure(configuration),
					),
				catch: (cause) => cause,
			}),
		),
	),
);
