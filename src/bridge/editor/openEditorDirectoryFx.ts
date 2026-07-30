import { Effect } from "effect";

import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";

/** Opens the canonical editor root or one contained project directory. */
export const openEditorDirectoryFx = Effect.fn("openEditorDirectoryFx")(function* (
	projectId?: string,
) {
	const workspace = yield* createEditorWorkspaceFx();
	yield* workspace.openDirectoryFx(projectId);
});
