import { Effect } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

const readStartItemAtLocationFn = (start: StartSchema.Type, location: BoardLocationSchema.Type) =>
	start.board.find(
		(entry) =>
			entry.space === location.space &&
			entry.x === location.position.x &&
			entry.y === location.position.y,
	);

const removeStartItemFn = (
	start: StartSchema.Type,
	location: BoardLocationSchema.Type,
): StartSchema.Type => ({
	...start,
	board: start.board.filter(
		(entry) =>
			entry.space !== location.space ||
			entry.x !== location.position.x ||
			entry.y !== location.position.y,
	),
});

const setStartItemFn = ({
	itemId,
	location,
	quantity,
	start,
}: {
	readonly itemId: IdSchema.Type;
	readonly location: BoardLocationSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly start: StartSchema.Type;
}): StartSchema.Type => {
	const entry = {
		itemId,
		quantity,
		space: location.space,
		x: location.position.x,
		y: location.position.y,
	};
	const index = start.board.findIndex(
		(candidate) =>
			candidate.space === location.space &&
			candidate.x === location.position.x &&
			candidate.y === location.position.y,
	);
	return {
		...start,
		board:
			index === -1
				? [
						...start.board,
						entry,
					]
				: start.board.map((candidate, candidateIndex) =>
						candidateIndex === index ? entry : candidate,
					),
	};
};
const readStartItemSetErrorFn = ({
	itemId,
	location,
	project,
	quantity,
}: {
	readonly itemId: IdSchema.Type;
	readonly location: BoardLocationSchema.Type;
	readonly project: Project;
	readonly quantity: PositiveIntegerSchema.Type;
}) => {
	const item = project.config.items[itemId];
	if (item === undefined) return `Item ${itemId} does not exist in the open project.`;
	if (quantity > item.maxStackSize)
		return `Item ${itemId} stack may contain at most ${item.maxStackSize}.`;
	const { height, width } = project.config.meta.board;
	if (location.position.x >= width || location.position.y >= height)
		return `Board position ${location.position.x},${location.position.y} does not fit inside ${width}x${height}.`;
	return undefined;
};
const formatStartLocationFn = (location: BoardLocationSchema.Type) =>
	[
		`Scope: ${location.scope}`,
		`Space: ${location.space}`,
		`Position: ${location.position.x},${location.position.y}`,
	].join("\n");

/** Sets or removes one exact authored initial stack through a revision-pinned config commit. */
export const updateStartItemFx = Effect.fn("updateStartItemFx")(function* ({
	change,
	location,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly change:
		| {
				readonly type: "set";
				readonly itemId: IdSchema.Type;
				readonly quantity: PositiveIntegerSchema.Type;
		  }
		| {
				readonly type: "remove";
		  };
	readonly location: BoardLocationSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision: number;
}) {
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read project_config again before editing start items.`,
			),
		);
	const previous = readStartItemAtLocationFn(project.config.start, location);
	if (change.type === "remove" && previous === undefined)
		return yield* Effect.fail(
			new Error(
				`No start item exists at ${formatStartLocationFn(location).replaceAll("\n", ", ")}.`,
			),
		);
	if (change.type === "set") {
		const error = readStartItemSetErrorFn({
			itemId: change.itemId,
			location,
			project,
			quantity: change.quantity,
		});
		if (error !== undefined) return yield* Effect.fail(new Error(error));
	}
	const start =
		change.type === "set"
			? setStartItemFn({
					itemId: change.itemId,
					location,
					quantity: change.quantity,
					start: project.config.start,
				})
			: removeStartItemFn(project.config.start, location);
	const commit = yield* commitProjectConfigFx({
		config: {
			...project.config,
			start,
		},
		notifyProjectChangedFn,
		project,
		repository,
		revision,
	});
	return [
		change.type === "set" ? "Set start item." : "Removed start item.",
		`Project ID: ${project.projectId}`,
		formatStartLocationFn(location),
		`Item ID: ${change.type === "set" ? change.itemId : previous?.itemId}`,
		`Quantity: ${change.type === "set" ? change.quantity : (previous?.quantity ?? 1)}`,
		...(change.type === "set"
			? [
					`Replaced: ${previous === undefined ? "no" : "yes"}`,
				]
			: []),
		`Revision: ${commit.revision}`,
	].join("\n");
});
