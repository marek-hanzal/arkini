import { Effect } from "effect";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Commits one complete MCP project-config candidate against the caller's read revision. */
export const commitProjectConfigFx = Effect.fn("commitProjectConfigFx")(function* ({
	config,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly config: GameConfigSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision?: number;
}) {
	if (revision !== undefined && revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read project_config again before editing the project.`,
			),
		);
	const commit = yield* repository.replaceConfigFx({
		config,
		expectedRevision: revision ?? project.revision,
		projectId: project.projectId,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return commit;
});
