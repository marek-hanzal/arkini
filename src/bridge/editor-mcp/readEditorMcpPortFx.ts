import { Effect } from "effect";

import { EditorMcpPortSchema } from "../../../electron/contract/editor/EditorMcpPortSchema";

export const readEditorMcpPortFx = () =>
	Effect.tryPromise({
		try: () => window.arkini.editorMcp.readPort(),
		catch: (cause) => cause,
	}).pipe(Effect.map(EditorMcpPortSchema.parse));
