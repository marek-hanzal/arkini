import { Effect } from "effect";

import { EditorMcpPortSchema } from "../../../electron/contract/editor/EditorMcpPortSchema";

export const writeEditorMcpPortFx = (candidate: unknown) =>
	Effect.try({
		try: () => EditorMcpPortSchema.parse(candidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((port) =>
			Effect.tryPromise({
				try: () => window.arkini.editorMcp.writePort(port),
				catch: (cause) => cause,
			}),
		),
	);
