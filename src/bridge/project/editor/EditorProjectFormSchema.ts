import { z } from "zod";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TitleSchema } from "~/engine/common/schema/TitleSchema";
import { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";

export const EditorProjectAvatarKeys = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

const EditorProjectFormBaseSchema = z
	.object({
		title: TitleSchema,
		hero: IdSchema,
		avatars: z.array(IdSchema).max(EditorProjectAvatarKeys.length),
		board: GridSizeSchema,
		inventory: GridSizeSchema,
		toolbarSize: ToolbarSizeSchema,
	})
	.strict();

export namespace EditorProjectFormSchema {
	export type Type = z.infer<typeof EditorProjectFormBaseSchema>;
}

/** Adds project-local resource and authored-start invariants to canonical field schemas. */
export const createEditorProjectFormSchema = (
	project: Pick<EditorProject, "config" | "resources">,
) => {
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
			if (startItem.x < value.board.width && startItem.y < value.board.height) continue;
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
			if (startItem.position.y === 0 && startItem.position.x < value.toolbarSize) continue;
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
				return item === undefined ? total : total + Math.ceil(quantity / item.maxStackSize);
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
};

export const readEditorProjectFormValues = (
	project: Pick<EditorProject, "config">,
): EditorProjectFormSchema.Type => ({
	title: project.config.meta.title,
	hero: project.config.resources.hero,
	avatars: EditorProjectAvatarKeys.flatMap((key) => {
		const resourceId = project.config.resources[key];
		return resourceId === undefined
			? []
			: [
					resourceId,
				];
	}),
	board: {
		...project.config.meta.board,
	},
	inventory: {
		...project.config.meta.inventory,
	},
	toolbarSize: project.config.meta.toolbarSize ?? 0,
});
