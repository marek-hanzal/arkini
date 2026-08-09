import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectFormBaseSchema } from "~/bridge/project/editor/EditorProjectFormSchema";
import { isItemLocationScopeAllowed } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Adds project-local resource and authored-start invariants to canonical field schemas. */
export const createEditorProjectFormSchemaFx = Effect.fn("createEditorProjectFormSchemaFx")(
	(project: Pick<EditorProject, "config" | "resources">) =>
		Effect.sync(() => {
			const resourceIds = new Set(project.resources.map(({ id }) => id));
			return EditorProjectFormBaseSchema.superRefine((value, context) => {
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

				const validateItem = (
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
					if (
						!isItemLocationScopeAllowed({
							item,
							locationScope: scope,
						})
					) {
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
					validateItem(
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
					validateItem(
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
					validateItem(
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
			});
		}),
);
