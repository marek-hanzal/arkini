import { Effect } from "effect";

import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

interface OptimizeEditorResourcesProps {
	readonly expectedRevision: number;
	readonly onProgressFn?: ProjectRepository.OptimizeResourcesProps["onProgressFn"];
	readonly projectId: string;
}

/** Optimizes every authored PNG and publishes the resulting canonical project. */
export const optimizeEditorResourcesFx = Effect.fn("optimizeEditorResourcesFx")(function* (
	props: OptimizeEditorResourcesProps,
) {
	const repository = yield* ProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const result = yield* repository.optimizeResourcesFx(props);
			yield* publishEditorProjectFx(props.projectId, {
				project: result.project,
			});
			return result;
		}),
	);
});
