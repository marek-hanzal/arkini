import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectFormBaseSchema } from "~/bridge/project/editor/EditorProjectFormSchema";

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
				for (const startItem of project.config.start.board) {
					if (startItem.x < value.board.width && startItem.y < value.board.height)
						continue;
					context.addIssue({
						code: "custom",
						message: `Initial board item ${startItem.itemId} at ${startItem.x}, ${startItem.y} does not fit inside the new board.`,
						path: [
							"board",
						],
					});
					break;
				}
				for (const startItem of project.config.start.toolbar) {
					if (startItem.position.y === 0 && startItem.position.x < value.toolbarSize)
						continue;
					context.addIssue({
						code: "custom",
						message: `Initial toolbar item ${startItem.itemId} at slot ${startItem.position.x + 1} does not fit inside the new toolbar.`,
						path: [
							"toolbarSize",
						],
					});
					break;
				}
				const inventoryQuantities = new Map<string, number>();
				for (const startItem of project.config.start.inventory) {
					inventoryQuantities.set(
						startItem.itemId,
						(inventoryQuantities.get(startItem.itemId) ?? 0) + startItem.quantity,
					);
				}
				const requiredInventorySlots = Array.from(inventoryQuantities).reduce(
					(total, [itemId, quantity]) => {
						const item = project.config.items[itemId];
						return item === undefined
							? total
							: total + Math.ceil(quantity / item.maxStackSize);
					},
					0,
				);
				const inventorySlots = value.inventory.width * value.inventory.height;
				if (requiredInventorySlots > inventorySlots) {
					context.addIssue({
						code: "custom",
						message: `Initial inventory needs ${requiredInventorySlots} slots but the new inventory has ${inventorySlots}.`,
						path: [
							"inventory",
						],
					});
				}
			});
		}),
);
