import { Effect } from "effect";

import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

const readLayoutBlockersFn = ({
	board,
	project,
}: {
	readonly board?: SizeSchema.Type;
	readonly project: Project;
}) => {
	const blockers: string[] = [];
	if (board !== undefined)
		for (const entry of project.config.start.board)
			if (entry.x >= board.width || entry.y >= board.height)
				blockers.push(
					`Board start item ${entry.itemId} at space ${entry.space}, position ${entry.x},${entry.y} does not fit inside ${board.width}x${board.height}.`,
				);
	return blockers;
};

/** Patches project layout capacities without removing authored initial items. */
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
	const blockers = readLayoutBlockersFn({
		board,
		project,
	});
	if (blockers.length > 0)
		return yield* Effect.fail(
			new Error(
				[
					"Project layout would exclude authored start items:",
					...blockers.map((blocker) => `- ${blocker}`),
				].join("\n"),
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
