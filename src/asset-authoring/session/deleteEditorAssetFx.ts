import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/publishEditorProjectFx";

interface DeleteEditorAssetProps {
	readonly expectedRevision: number;
	readonly projectId: string;
	readonly resourceId: string;
}

/** Deletes one unreferenced asset and publishes the canonical project snapshot. */
export const deleteEditorAssetFx = Effect.fn("deleteEditorAssetFx")(function* (
	props: DeleteEditorAssetProps,
) {
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.deleteResourceFx(props);
			yield* publishEditorProjectFx(props.projectId, {
				project,
			});
			return project;
		}),
	);
});
