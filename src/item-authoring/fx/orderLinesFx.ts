import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { saveWithRepositoryFx } from "./saveWithRepositoryFx";

/** Validates an exact permutation before one revision-guarded item write. */
export const orderLinesFx = Effect.fn("orderItemLinesFx")(function* ({
	project,
	itemUid,
	lineUids,
	revision,
	repository,
}: {
	readonly project: Project;
	readonly itemUid: string;
	readonly lineUids: ReadonlyArray<string>;
	readonly revision: number;
	readonly repository: ProjectRepositoryService;
}) {
	const item = project.config.items[itemUid];
	if (!Object.hasOwn(project.config.items, itemUid) || item === undefined)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message: `Item ${itemUid} does not exist.`,
			}),
		);
	if (revision !== project.revision)
		return yield* Effect.fail(
			new ProjectRepositoryError({
				operation: "upsert-item",
				reason: "revision-conflict",
				message: `Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_json again before ordering lines.`,
			}),
		);
	const byUid = new Map(
		item.lines.map((line) => [
			line.uid,
			line,
		]),
	);
	if (new Set(lineUids).size !== lineUids.length)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message:
					"lineUids must contain each line UID exactly once; duplicates are not allowed.",
			}),
		);
	const lines = [];
	for (const lineUid of lineUids) {
		const line = byUid.get(lineUid);
		if (line === undefined)
			return yield* Effect.fail(
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Line ${lineUid} does not exist on item ${itemUid}.`,
				}),
			);
		lines.push(line);
	}
	if (lines.length !== item.lines.length)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message: `lineUids must include all ${item.lines.length} lines on item ${itemUid}; received ${lines.length}.`,
			}),
		);
	// The repository checks the revision again so a concurrent edit cannot be overwritten.
	return yield* saveWithRepositoryFx({
		expectedRevision: revision,
		item: {
			...item,
			lines,
		},
		projectId: project.projectId,
		repository,
	});
});
