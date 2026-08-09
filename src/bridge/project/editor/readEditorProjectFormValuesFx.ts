import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	type EditorProjectFormSchema,
	EditorProjectAvatarKeys,
} from "~/bridge/project/editor/EditorProjectFormSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";

const positionKey = ({ x, y }: PositionSchema.Type) => `${x}:${y}`;

const readInventoryStart = (
	project: Pick<EditorProject, "config">,
): EditorProjectFormSchema.Type["start"]["inventory"] => {
	const size = project.config.meta.inventory;
	const slots: EditorProjectFormSchema.Type["start"]["inventory"] = [];
	const byPosition = new Map<string, number>();
	const rowMajorPositions: PositionSchema.Type[] = [];
	for (let y = 0; y < size.height; y += 1) {
		for (let x = 0; x < size.width; x += 1)
			rowMajorPositions.push({
				x,
				y,
			});
	}
	const addExact = (itemId: string, quantity: number, position: PositionSchema.Type) => {
		const index = slots.length;
		slots.push({
			itemId,
			position,
			quantity,
		});
		if (!byPosition.has(positionKey(position))) byPosition.set(positionKey(position), index);
	};

	for (const entry of project.config.start.inventory) {
		if (entry.position !== undefined) {
			addExact(entry.itemId, entry.quantity, entry.position);
			continue;
		}
		let remaining = entry.quantity;
		const maxStackSize = project.config.items[entry.itemId]?.maxStackSize ?? 1;
		for (const position of rowMajorPositions) {
			if (remaining <= 0) break;
			const index = byPosition.get(positionKey(position));
			if (index === undefined) continue;
			const current = slots[index];
			if (current === undefined || current.itemId !== entry.itemId) continue;
			const available = Math.max(0, maxStackSize - current.quantity);
			if (available === 0) continue;
			const added = Math.min(available, remaining);
			slots[index] = {
				...current,
				quantity: current.quantity + added,
			};
			remaining -= added;
		}
		for (const position of rowMajorPositions) {
			if (remaining <= 0) break;
			if (byPosition.has(positionKey(position))) continue;
			const quantity = Math.min(maxStackSize, remaining);
			addExact(entry.itemId, quantity, position);
			remaining -= quantity;
		}
		if (remaining > 0) {
			const width = Math.max(1, size.width);
			let overflowIndex = 0;
			let position = {
				x: 0,
				y: size.height,
			};
			while (byPosition.has(positionKey(position))) {
				overflowIndex += 1;
				position = {
					x: overflowIndex % width,
					y: size.height + Math.floor(overflowIndex / width),
				};
			}
			addExact(entry.itemId, remaining, position);
		}
	}
	return slots;
};

/** Reads one canonical Project form value from the current project snapshot. */
export const readEditorProjectFormValuesFx = Effect.fn("readEditorProjectFormValuesFx")(
	(project: Pick<EditorProject, "config">) =>
		Effect.sync(
			(): EditorProjectFormSchema.Type => ({
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
				start: {
					currentSpace: project.config.start.currentSpace,
					board: project.config.start.board.map((entry) => ({
						...entry,
						quantity: entry.quantity ?? 1,
					})),
					inventory: readInventoryStart(project),
					toolbar: project.config.start.toolbar.map((entry) => ({
						...entry,
						position: {
							...entry.position,
						},
						quantity: entry.quantity ?? 1,
					})),
				},
			}),
		),
);
