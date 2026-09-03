import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import type { EditProjectInput } from "./EditProjectInputSchema";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

/** Replaces supplied whole project sections and exact-pins the read-to-commit revision. */
export const editProjectFx = Effect.fn("editProjectFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
}: {
	readonly input: EditProjectInput;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
}) {
	const config = {
		...project.config,
		...input.patch,
		meta:
			input.patch.meta === undefined
				? project.config.meta
				: {
						...input.patch.meta,
						id: project.config.meta.id,
					},
	};
	const commit = yield* commitProjectConfigFx({
		config,
		notifyProjectChangedFn,
		project,
		repository,
		revision: input.revision,
	});
	return [
		"Edited project configuration.",
		`Project ID: ${project.projectId}`,
		`Revision: ${commit.revision}`,
		`Replaced: ${Object.keys(input.patch).sort().join(", ")}`,
	].join("\n");
});
