import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace readEditorProjectFx {
	export interface Props {
		readonly projectId: string;
	}
}

/** Reads one canonical project from the editor repository. */
export const readEditorProjectFx = Effect.fn("readEditorProjectFx")(function* ({
	projectId,
}: readEditorProjectFx.Props) {
	const repository = yield* EditorProjectRepository;
	const project = yield* repository.readProjectFx(projectId);
	if (project === null) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "project-not-found",
				message: `Editor project ${projectId} does not exist.`,
			}),
		);
	}
	return project;
});
