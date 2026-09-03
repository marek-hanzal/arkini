import { Effect } from "effect";

import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

const readLayoutBlockersFn = ({
	board,
	inventory,
	project,
	toolbarSize,
}: {
	readonly board?: SizeSchema.Type;
	readonly inventory?: SizeSchema.Type;
	readonly project: Project;
	readonly toolbarSize?: ToolbarSizeSchema.Type;
}) => {
	const blockers: string[] = [];
	if (board !== undefined)
		for (const entry of project.config.start.board)
			if (entry.x >= board.width || entry.y >= board.height)
				blockers.push(
					`Board start item ${entry.itemId} at space ${entry.space}, position ${entry.x},${entry.y} does not fit inside ${board.width}x${board.height}.`,
				);
	if (inventory !== undefined)
		for (const entry of project.config.start.inventory)
			if (entry.position.x >= inventory.width || entry.position.y >= inventory.height)
				blockers.push(
					`Inventory start item ${entry.itemId} at position ${entry.position.x},${entry.position.y} does not fit inside ${inventory.width}x${inventory.height}.`,
				);
	if (toolbarSize !== undefined)
		for (const entry of project.config.start.toolbar)
			if (entry.position.y !== 0 || entry.position.x >= toolbarSize)
				blockers.push(
					`Toolbar start item ${entry.itemId} at position ${entry.position.x},${entry.position.y} does not fit inside ${toolbarSize} slots.`,
				);
	return blockers;
};

/** Patches project layout capacities without removing authored initial items. */
export const editProjectLayoutFx = Effect.fn("editProjectLayoutFx")(function* ({
	board,
	inventory,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
	toolbarSize,
}: {
	readonly board?: SizeSchema.Type;
	readonly inventory?: SizeSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision: number;
	readonly toolbarSize?: ToolbarSizeSchema.Type;
}) {
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read project_config again before editing the project layout.`,
			),
		);
	const blockers = readLayoutBlockersFn({
		board,
		inventory,
		project,
		toolbarSize,
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
		...(inventory === undefined
			? {}
			: {
					inventory,
				}),
		...(toolbarSize === undefined
			? {}
			: {
					toolbarSize,
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
		`Inventory: ${meta.inventory.width} x ${meta.inventory.height}`,
		`Toolbar: ${meta.toolbarSize ?? 0} slots`,
	].join("\n");
});
