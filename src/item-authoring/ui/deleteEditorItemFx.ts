import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/publishEditorProjectFx";

export namespace deleteEditorItemFx {
	export interface Props {
		readonly expectedRevision: number;
		readonly force: boolean;
		readonly itemUid: string;
		readonly projectId: string;
	}
}

/** Deletes one item under the requested safe or force contract and publishes the commit. */
export const deleteEditorItemFx = Effect.fn("deleteEditorItemFx")(function* (
	props: deleteEditorItemFx.Props,
) {
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const commit = yield* repository.deleteItemFx(props);
			yield* publishEditorProjectFx(props.projectId, {
				commit,
			});
			return commit;
		}),
	);
});
