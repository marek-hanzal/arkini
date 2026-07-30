import { Effect } from "effect";

import { EditorWorkspaceError } from "~/bridge/editor/EditorWorkspaceError";

/** Adapts one typed preload editor Promise into the renderer Effect error channel. */
export const invokeEditorTransportFx = Effect.fn("invokeEditorTransportFx")(
	<Value>(operation: EditorWorkspaceError["operation"], call: () => Promise<Value>) =>
		Effect.tryPromise({
			try: call,
			catch: (cause) =>
				new EditorWorkspaceError({
					operation,
					cause,
				}),
		}),
);
