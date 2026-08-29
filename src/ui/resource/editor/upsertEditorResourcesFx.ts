import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/publishEditorProjectFx";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";

export namespace upsertEditorResourcesFx {
	export interface Props {
		readonly projectId: string;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}
}

/** Atomically upserts validated resources and publishes the canonical project snapshot. */
export const upsertEditorResourcesFx = Effect.fn("upsertEditorResourcesFx")(function* ({
	projectId,
	resources,
}: upsertEditorResourcesFx.Props) {
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.upsertResourcesFx({
				projectId,
				resources,
			});
			yield* publishEditorProjectFx(projectId, {
				project,
			});
			return {
				project,
				resourceIds: resources.map(({ id }) => id),
			};
		}),
	);
});
