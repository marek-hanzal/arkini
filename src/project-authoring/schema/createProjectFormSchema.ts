import type { Project } from "~/project-authoring/type/Project";
import { ProjectFormBaseSchema } from "~/project-authoring/schema/ProjectFormSchema";
import { readProjectStartItemIdsFn } from "~/project-authoring/fn/readProjectStartItemIdsFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/** Adds project-local resource and authored-start invariants to canonical field schemas. */
export const createProjectFormSchema = (project: Pick<Project, "config" | "resources">) => {
	const resourceIds = new Set(project.resources.map(({ id }) => id));
	const allowedStartItemIds = new Map([
		[
			LocationScopeEnumSchema.enum.Board,
			readProjectStartItemIdsFn({
				items: project.config.items,
				scope: LocationScopeEnumSchema.enum.Board,
			}),
		],
		[
			LocationScopeEnumSchema.enum.Inventory,
			readProjectStartItemIdsFn({
				items: project.config.items,
				scope: LocationScopeEnumSchema.enum.Inventory,
			}),
		],
		[
			LocationScopeEnumSchema.enum.Toolbar,
			readProjectStartItemIdsFn({
				items: project.config.items,
				scope: LocationScopeEnumSchema.enum.Toolbar,
			}),
		],
	] as const);

	return ProjectFormBaseSchema.superRefine((value, context) => {
		if (!resourceIds.has(value.hero)) {
			context.addIssue({
				code: "custom",
				message: `Hero asset ${value.hero} does not exist in this project.`,
				path: [
					"hero",
				],
			});
		}
		const seenAvatars = new Set<string>();
		value.avatars.forEach((avatar, index) => {
			if (!resourceIds.has(avatar)) {
				context.addIssue({
					code: "custom",
					message: `Avatar asset ${avatar} does not exist in this project.`,
					path: [
						"avatars",
						index,
					],
				});
			}
			if (seenAvatars.has(avatar)) {
				context.addIssue({
					code: "custom",
					message: `Avatar asset ${avatar} is already selected.`,
					path: [
						"avatars",
						index,
					],
				});
			}
			seenAvatars.add(avatar);
		});

		const validateItemFn = (
			itemId: string,
			quantity: number,
			scope:
				| typeof LocationScopeEnumSchema.enum.Board
				| typeof LocationScopeEnumSchema.enum.Inventory
				| typeof LocationScopeEnumSchema.enum.Toolbar,
			path: (string | number)[],
		) => {
			const item = project.config.items[itemId];
			if (item === undefined) {
				context.addIssue({
					code: "custom",
					message: `Initial item ${itemId} does not exist in this project.`,
					path,
				});
				return;
			}
			if (!allowedStartItemIds.get(scope)?.has(itemId)) {
				context.addIssue({
					code: "custom",
					message: `${item.title} cannot be stored in ${scope}.`,
					path,
				});
			}
			if (quantity > item.maxStackSize) {
				context.addIssue({
					code: "custom",
					message: `${item.title} stack may contain at most ${item.maxStackSize}.`,
					path,
				});
			}
		};

		const boardLocations = new Set<string>();
		value.start.board.forEach((startItem, index) => {
			const path = [
				"start",
				"board",
				index,
			];
			validateItemFn(
				startItem.itemId,
				startItem.quantity,
				LocationScopeEnumSchema.enum.Board,
				path,
			);
			if (startItem.x >= value.board.width || startItem.y >= value.board.height) {
				context.addIssue({
					code: "custom",
					message: `Initial board item ${startItem.itemId} at ${startItem.x}, ${startItem.y} does not fit inside the board.`,
					path,
				});
			}
			const key = `${startItem.space}:${startItem.x}:${startItem.y}`;
			if (boardLocations.has(key)) {
				context.addIssue({
					code: "custom",
					message: `Initial board slot ${startItem.x}, ${startItem.y} in space ${startItem.space} is used more than once.`,
					path,
				});
			}
			boardLocations.add(key);
		});

		const toolbarLocations = new Set<number>();
		value.start.toolbar.forEach((startItem, index) => {
			const path = [
				"start",
				"toolbar",
				index,
			];
			validateItemFn(
				startItem.itemId,
				startItem.quantity,
				LocationScopeEnumSchema.enum.Toolbar,
				path,
			);
			if (startItem.position.y !== 0 || startItem.position.x >= value.toolbarSize) {
				context.addIssue({
					code: "custom",
					message: `Initial toolbar item ${startItem.itemId} at slot ${startItem.position.x + 1} does not fit inside the toolbar.`,
					path,
				});
			}
			if (toolbarLocations.has(startItem.position.x)) {
				context.addIssue({
					code: "custom",
					message: `Initial toolbar slot ${startItem.position.x + 1} is used more than once.`,
					path,
				});
			}
			toolbarLocations.add(startItem.position.x);
		});

		const inventoryLocations = new Set<string>();
		value.start.inventory.forEach((startItem, index) => {
			const path = [
				"start",
				"inventory",
				index,
			];
			validateItemFn(
				startItem.itemId,
				startItem.quantity,
				LocationScopeEnumSchema.enum.Inventory,
				path,
			);
			if (
				startItem.position.x >= value.inventory.width ||
				startItem.position.y >= value.inventory.height
			) {
				context.addIssue({
					code: "custom",
					message: `Initial inventory item ${startItem.itemId} at ${startItem.position.x}, ${startItem.position.y} does not fit inside the inventory.`,
					path,
				});
			}
			const key = `${startItem.position.x}:${startItem.position.y}`;
			if (inventoryLocations.has(key)) {
				context.addIssue({
					code: "custom",
					message: `Initial inventory slot ${startItem.position.x}, ${startItem.position.y} is used more than once.`,
					path,
				});
			}
			inventoryLocations.add(key);
		});

		const startItemQuantities = new Map<string, number>();
		const validateMaxCountFn = (
			itemId: string,
			quantity: number,
			path: (string | number)[],
		) => {
			const nextQuantity = (startItemQuantities.get(itemId) ?? 0) + quantity;
			startItemQuantities.set(itemId, nextQuantity);
			const item = project.config.items[itemId];
			if (item?.maxCount === undefined || nextQuantity <= item.maxCount) return;
			context.addIssue({
				code: "custom",
				message: `${item.title} may exist at most ${item.maxCount} times, but this start state would contain ${nextQuantity}.`,
				path,
			});
		};
		value.start.board.forEach((startItem, index) =>
			validateMaxCountFn(startItem.itemId, startItem.quantity, [
				"start",
				"board",
				index,
			]),
		);
		value.start.inventory.forEach((startItem, index) =>
			validateMaxCountFn(startItem.itemId, startItem.quantity, [
				"start",
				"inventory",
				index,
			]),
		);
		value.start.toolbar.forEach((startItem, index) =>
			validateMaxCountFn(startItem.itemId, startItem.quantity, [
				"start",
				"toolbar",
				index,
			]),
		);
	});
};
