import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";

export namespace readProjectFx {
	export interface Props {
		readonly projectId: string;
	}
}

/** Reads one canonical project from the editor repository. */
export const readProjectFx = Effect.fn("readEditorProjectFx")(function* ({
	projectId,
}: readProjectFx.Props) {
	const repository = yield* ProjectRepository;
	const project = yield* repository.readProjectFx(projectId);
	if (project === null) {
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "project-not-found",
				message: `Editor project ${projectId} does not exist.`,
			}),
		);
	}
	return project;
});
