import { Effect } from "effect";
import {
	EditorProjectManifestSchema,
} from "../../../electron/contract/editor/EditorProjectManifest";

import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import { EditorWorkspaceError } from "~/bridge/editor/EditorWorkspaceError";

export namespace listEditorProjectsFx {
	export interface Props {
		readonly workspace?: EditorWorkspace;
	}
}

/** Lists manifest-backed editor projects in canonical recent order. */
export const listEditorProjectsFx = Effect.fn("listEditorProjectsFx")(function* ({
	workspace: providedWorkspace,
}: listEditorProjectsFx.Props = {}) {
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	const manifests = yield* workspace.listFx();
	return yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.array()
				.parse(manifests)
				.map(
					({ projectId, title, game, createdAtMs, updatedAtMs }) =>
						({
							projectId,
							title,
							...(game === undefined ? {} : { game }),
							createdAtMs,
							updatedAtMs,
						}) satisfies EditorProjectDescriptor,
				),
		catch: (cause) =>
			new EditorWorkspaceError({
				operation: "list",
				cause,
			}),
	});
});
