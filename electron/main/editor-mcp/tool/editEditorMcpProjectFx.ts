import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import type { EditorMcpEditProjectInput } from "./EditorMcpProjectInputSchemas";
import { notifyEditorMcpProjectChangedFx } from "./notifyEditorMcpProjectChangedFx";

/** Replaces supplied whole project sections and exact-pins the read-to-commit revision. */
export const editEditorMcpProjectFx = Effect.fn("editEditorMcpProjectFx")(function* ({
	input,
	notifyProjectChanged,
	project,
	repository,
}: {
	readonly input: EditorMcpEditProjectInput;
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly project: EditorProject;
	readonly repository: EditorProjectRepositoryService;
}) {
	if (input.revision !== undefined && input.revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${input.revision} is stale; the open project is at revision ${project.revision}. Read project_config again before replacing a section.`,
			),
		);
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
	const commit = yield* repository.replaceConfigFx({
		config,
		expectedRevision: input.revision ?? project.revision,
		projectId: project.projectId,
	});
	yield* notifyEditorMcpProjectChangedFx(notifyProjectChanged, project.projectId);
	return [
		"Edited project configuration.",
		`Project ID: ${project.projectId}`,
		`Revision: ${commit.revision}`,
		`Replaced: ${Object.keys(input.patch).sort().join(", ")}`,
	].join("\n");
});
