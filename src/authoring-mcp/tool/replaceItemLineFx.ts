import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { ReplaceItemLineInputSchema } from "./ReplaceItemLineInputSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Atomically replaces one existing line while preserving its position and every other item field. */
export const replaceItemLineFx = Effect.fn("replaceItemLineFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
}: {
	readonly input: ReplaceItemLineInputSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
}) {
	const current = project.config.items[input.itemId];
	if (current === undefined)
		return yield* Effect.fail(new Error(`Item ${input.itemId} does not exist.`));
	if (input.revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${input.revision} is stale; the open project is at revision ${project.revision}. Read item_config again before replacing a line.`,
			),
		);
	if (input.line.id !== input.lineId)
		return yield* Effect.fail(
			new Error(
				`Replacement line ID ${input.line.id} must match target line ID ${input.lineId}.`,
			),
		);
	const matchingLines = current.lines.filter(({ id }) => id === input.lineId);
	if (matchingLines.length === 0)
		return yield* Effect.fail(
			new Error(`Line ${input.lineId} does not exist on item ${input.itemId}.`),
		);
	if (matchingLines.length > 1)
		return yield* Effect.fail(
			new Error(
				`Line ${input.lineId} is ambiguous on item ${input.itemId}; fix its duplicate line IDs before replacing it.`,
			),
		);

	const { commit } = yield* saveWithRepositoryFx({
		config: project.config,
		expectedRevision: input.revision,
		item: {
			...current,
			lines: current.lines.map((line) => (line === matchingLines[0] ? input.line : line)),
		},
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		"Replaced item line.",
		`Item ID: ${input.itemId}`,
		`Line ID: ${input.lineId}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});
