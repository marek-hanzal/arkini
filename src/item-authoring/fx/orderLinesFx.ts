import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { saveWithRepositoryFx } from "./saveWithRepositoryFx";

/** Validates an exact permutation before one revision-guarded item write. */
export const orderLinesFx = Effect.fn("orderItemLinesFx")(function* ({
	project,
	itemId,
	lineIds,
	revision,
	repository,
}: {
	readonly project: Project;
	readonly itemId: string;
	readonly lineIds: ReadonlyArray<string>;
	readonly revision: number;
	readonly repository: ProjectRepositoryService;
}) {
	const item = project.config.items[itemId];
	if (item === undefined)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message: `Item ${itemId} does not exist.`,
			}),
		);
	if (revision !== project.revision)
		return yield* Effect.fail(
			new ProjectRepositoryError({
				operation: "upsert-item",
				reason: "revision-conflict",
				message: `Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_config again before ordering lines.`,
			}),
		);
	const byId = new Map(
		item.lines.map((line) => [
			line.id,
			line,
		]),
	);
	if (byId.size !== item.lines.length)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message: `Item ${itemId} has duplicate line IDs; their order is ambiguous.`,
			}),
		);
	if (new Set(lineIds).size !== lineIds.length)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message:
					"lineIds must contain each line ID exactly once; duplicates are not allowed.",
			}),
		);
	const lines = [];
	for (const lineId of lineIds) {
		const line = byId.get(lineId);
		if (line === undefined)
			return yield* Effect.fail(
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Line ${lineId} does not exist on item ${itemId}.`,
				}),
			);
		lines.push(line);
	}
	if (lines.length !== item.lines.length)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message: `lineIds must include all ${item.lines.length} lines on item ${itemId}; received ${lines.length}.`,
			}),
		);
	// The repository checks the revision again so a concurrent edit cannot be overwritten.
	return yield* saveWithRepositoryFx({
		config: project.config,
		expectedRevision: revision,
		item: {
			...item,
			lines,
		},
		projectId: project.projectId,
		repository,
	});
});
