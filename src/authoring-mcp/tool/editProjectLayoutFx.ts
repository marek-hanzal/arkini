import { Effect } from "effect";

import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

/** Patches fallback board dimensions; templates retain their independent dimensions. */
export const editProjectLayoutFx = Effect.fn("editProjectLayoutFx")(function* ({
	board,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly board?: SizeSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision: number;
}) {
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read project_config again before editing the project layout.`,
			),
		);
	const meta = {
		...project.config.meta,
		...(board === undefined
			? {}
			: {
					board,
				}),
	};
	const commit = yield* commitProjectConfigFx({
		config: {
			...project.config,
			meta,
		},
		notifyProjectChangedFn,
		project,
		repository,
		revision,
	});
	return [
		"Edited project layout.",
		`Project ID: ${project.projectId}`,
		`Revision: ${commit.revision}`,
		`Board: ${meta.board.width} x ${meta.board.height}`,
	].join("\n");
});
