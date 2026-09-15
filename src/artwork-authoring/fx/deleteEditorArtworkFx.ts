import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

interface DeleteEditorArtworkProps {
	readonly expectedRevision: number;
	readonly projectId: string;
	readonly resourceId: string;
}

/** Deletes one unreferenced Editor artwork and publishes the canonical project snapshot. */
export const deleteEditorArtworkFx = Effect.fn("deleteEditorArtworkFx")(function* (
	props: DeleteEditorArtworkProps,
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
