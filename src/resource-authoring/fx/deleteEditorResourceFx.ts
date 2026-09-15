import { Effect } from "effect";

import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

/** Deletes one Editor resource and publishes the canonical project snapshot. */
export const deleteEditorResourceFx = Effect.fn("deleteEditorResourceFx")(function* (props: {
	readonly expectedRevision: number;
	readonly projectId: string;
	readonly resourceId: string;
}) {
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
