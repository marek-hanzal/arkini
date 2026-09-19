import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { CreateItemLineInputSchema } from "./CreateItemLineInputSchema";
import type { DeleteItemLineInputSchema } from "./DeleteItemLineInputSchema";
import type { ReplaceItemLineInputSchema } from "./ReplaceItemLineInputSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** One revision-guarded line edit; the repository rechecks admission before committing. */
export const mutateItemLineFx = Effect.fn("mutateItemLineFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
}: {
	readonly input: mutateItemLineFx.Command;
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
				`Revision ${input.revision} is stale; the open project is at revision ${project.revision}. Read item_config again before editing a line.`,
			),
		);
	const lineId = input.operation === "create" ? input.line.id : input.lineId;
	const matchingLines = current.lines.filter(({ id }) => id === lineId);
	if (input.operation === "replace" && input.line.id !== lineId)
		return yield* Effect.fail(
			new Error(`Replacement line ID ${input.line.id} must match target line ID ${lineId}.`),
		);
	if (input.operation === "create" && matchingLines.length > 0)
		return yield* Effect.fail(
			new Error(`Line ${lineId} already exists on item ${input.itemId}.`),
		);
	if (input.operation !== "create" && matchingLines.length === 0)
		return yield* Effect.fail(
			new Error(`Line ${lineId} does not exist on item ${input.itemId}.`),
		);
	if (input.operation !== "create" && matchingLines.length > 1)
		return yield* Effect.fail(
			new Error(
				`Line ${lineId} is ambiguous on item ${input.itemId}; fix its duplicate line IDs before editing it.`,
			),
		);
	const lines =
		input.operation === "create"
			? [
					...current.lines,
					input.line,
				]
			: input.operation === "delete"
				? current.lines.filter((line) => line !== matchingLines[0])
				: current.lines.map((line) => (line === matchingLines[0] ? input.line : line));

	const { commit } = yield* saveWithRepositoryFx({
		config: project.config,
		expectedRevision: input.revision,
		item: {
			...current,
			lines,
		},
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		`${input.operation === "create" ? "Created" : input.operation === "delete" ? "Deleted" : "Replaced"} item line.`,
		`Item ID: ${input.itemId}`,
		`Line ID: ${lineId}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});

export namespace mutateItemLineFx {
	export type Command =
		| (CreateItemLineInputSchema.Type & {
				readonly operation: "create";
		  })
		| (ReplaceItemLineInputSchema.Type & {
				readonly operation: "replace";
		  })
		| (DeleteItemLineInputSchema.Type & {
				readonly operation: "delete";
		  });
}
