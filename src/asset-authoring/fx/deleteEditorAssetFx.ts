import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

interface DeleteEditorAssetProps {
	readonly expectedRevision: number;
	readonly projectId: string;
	readonly resourceId: string;
}

/** Deletes one unreferenced Editor asset and publishes the canonical project snapshot. */
export const deleteEditorAssetFx = Effect.fn("deleteEditorAssetFx")(function* (
	props: DeleteEditorAssetProps,
) {
	const repository = yield* ProjectRepository;
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
