import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { StartLocationSchema } from "~/game-start/schema/StartLocationSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";
import { isItemLocationScopeAllowedFn } from "~/item-location/fn/isItemLocationScopeAllowedFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

interface StartItemAtLocation {
	readonly itemId: IdSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
}

const readStartItemQuantityFn = (start: StartSchema.Type, itemId: IdSchema.Type) =>
	start.board.reduce(
		(quantity, entry) => quantity + (entry.itemId === itemId ? (entry.quantity ?? 1) : 0),
		0,
	) +
	start.inventory.reduce(
		(quantity, entry) => quantity + (entry.itemId === itemId ? entry.quantity : 0),
		0,
	) +
	start.toolbar.reduce(
		(quantity, entry) => quantity + (entry.itemId === itemId ? (entry.quantity ?? 1) : 0),
		0,
	);

const readStartItemAtLocationFn = (
	start: StartSchema.Type,
	location: StartLocationSchema.Type,
): StartItemAtLocation | undefined => {
	if (location.scope === LocationScopeEnumSchema.enum.Board) {
		const entry = start.board.find(
			(candidate) =>
				candidate.space === location.space &&
				candidate.x === location.position.x &&
				candidate.y === location.position.y,
		);
		return entry === undefined
			? undefined
			: {
					itemId: entry.itemId,
					quantity: entry.quantity ?? 1,
				};
	}
	const entries =
		location.scope === LocationScopeEnumSchema.enum.Inventory ? start.inventory : start.toolbar;
	const entry = entries.find(
		(candidate) =>
			candidate.position.x === location.position.x &&
			candidate.position.y === location.position.y,
	);
	return entry === undefined
		? undefined
		: {
				itemId: entry.itemId,
				quantity: entry.quantity ?? 1,
			};
};

const setStartItemFn = ({
	itemId,
	location,
	quantity,
	start,
}: {
	readonly itemId: IdSchema.Type;
	readonly location: StartLocationSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly start: StartSchema.Type;
}): StartSchema.Type => {
	if (location.scope === LocationScopeEnumSchema.enum.Board) {
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
	}
	const entry = {
		itemId,
		position: location.position,
		quantity,
	};
	const key = location.scope === LocationScopeEnumSchema.enum.Inventory ? "inventory" : "toolbar";
	const entries = start[key];
	const index = entries.findIndex(
		(candidate) =>
			candidate.position.x === location.position.x &&
			candidate.position.y === location.position.y,
	);
	return {
		...start,
		[key]:
			index === -1
				? [
						...entries,
						entry,
					]
				: entries.map((candidate, candidateIndex) =>
						candidateIndex === index ? entry : candidate,
					),
	};
};

const removeStartItemFn = (
	start: StartSchema.Type,
	location: StartLocationSchema.Type,
): StartSchema.Type => {
	if (location.scope === LocationScopeEnumSchema.enum.Board)
		return {
			...start,
			board: start.board.filter(
				(entry) =>
					entry.space !== location.space ||
					entry.x !== location.position.x ||
					entry.y !== location.position.y,
			),
		};
	const key = location.scope === LocationScopeEnumSchema.enum.Inventory ? "inventory" : "toolbar";
	return {
		...start,
		[key]: start[key].filter(
			(entry) =>
				entry.position.x !== location.position.x ||
				entry.position.y !== location.position.y,
		),
	};
};

const readStartItemSetErrorFn = ({
	itemId,
	location,
	previous,
	project,
	quantity,
}: {
	readonly itemId: IdSchema.Type;
	readonly location: StartLocationSchema.Type;
	readonly previous: StartItemAtLocation | undefined;
	readonly project: Project;
	readonly quantity: PositiveIntegerSchema.Type;
}) => {
	const item = project.config.items[itemId];
	if (item === undefined) return `Item ${itemId} does not exist in the open project.`;
	if (
		!isItemLocationScopeAllowedFn({
			item,
			locationScope: location.scope,
		})
	)
		return `Item ${itemId} cannot be stored in ${location.scope}.`;
	if (quantity > item.maxStackSize)
		return `Item ${itemId} stack may contain at most ${item.maxStackSize}.`;
	const nextItemQuantity =
		readStartItemQuantityFn(project.config.start, itemId) -
		(previous?.itemId === itemId ? previous.quantity : 0) +
		quantity;
	if (item.maxCount !== undefined && nextItemQuantity > item.maxCount)
		return `Item ${itemId} may exist at most ${item.maxCount} times, but this start state would contain ${nextItemQuantity}.`;
	if (location.scope === LocationScopeEnumSchema.enum.Board) {
		const { height, width } = project.config.meta.board;
		if (location.position.x >= width || location.position.y >= height)
			return `Board position ${location.position.x},${location.position.y} does not fit inside ${width}x${height}.`;
	}
	if (location.scope === LocationScopeEnumSchema.enum.Inventory) {
		const { height, width } = project.config.meta.inventory;
		if (location.position.x >= width || location.position.y >= height)
			return `Inventory position ${location.position.x},${location.position.y} does not fit inside ${width}x${height}.`;
	}
	if (
		location.scope === LocationScopeEnumSchema.enum.Toolbar &&
		location.position.x >= (project.config.meta.toolbarSize ?? 0)
	)
		return `Toolbar position ${location.position.x} does not fit inside ${project.config.meta.toolbarSize ?? 0} slots.`;
	return undefined;
};

const formatStartLocationFn = (location: StartLocationSchema.Type) =>
	[
		`Scope: ${location.scope}`,
		...(location.scope === LocationScopeEnumSchema.enum.Board
			? [
					`Space: ${location.space}`,
				]
			: []),
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
	readonly location: StartLocationSchema.Type;
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
			previous,
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
		`Quantity: ${change.type === "set" ? change.quantity : previous?.quantity}`,
		...(change.type === "set"
			? [
					`Replaced: ${previous === undefined ? "no" : "yes"}`,
				]
			: []),
		`Revision: ${commit.revision}`,
	].join("\n");
});
