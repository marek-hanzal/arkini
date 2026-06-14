import { boardCellNodeId } from "~/board/boardCellNodeId";
import { inventoryNavDropTargetNodeId } from "~/inventory/inventoryNavDropTargetNodeId";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import { nearestMagneticElement } from "~/interaction/magnetic/nearestMagneticElement";
import type { MagneticDropContext } from "~/drag/MagneticDropContext";
import type { DragSource, DropData, DropTarget, VisualMeta } from "~/play/types";

export const resolveMagneticDropTarget = ({
	source,
	dragRect,
}: MagneticDropContext<string, DragSource, VisualMeta>): DropData | null => {
	if (source.source.kind === "board") {
		const inventory = nearestMagneticElement("[data-inventory-drop-target]", dragRect);
		if (inventory) {
			const nodeId =
				inventory.element.getAttribute("data-drag-node-id") ?? inventoryNavDropTargetNodeId;

			return {
				targetId: nodeId,
				targetNodeId: nodeId,
				target: {
					kind: "inventory",
				},
			} satisfies DropData;
		}

		const cell = nearestMagneticElement("[data-board-cell]", dragRect);
		if (!cell) return null;

		const [x, y] = (cell.element.getAttribute("data-board-cell") ?? "").split(":").map(Number);
		if (!Number.isInteger(x) || !Number.isInteger(y)) return null;

		const nodeId = cell.element.getAttribute("data-drag-node-id") ?? boardCellNodeId(x, y);
		return {
			targetId: nodeId,
			targetNodeId: nodeId,
			target: {
				kind: "cell",
				x,
				y,
				boardItemId: cell.element.getAttribute("data-board-item-id") || undefined,
			},
		} satisfies DropData;
	}

	const slot = nearestMagneticElement("[data-inventory-slot]", dragRect);
	if (!slot) return null;

	const slotIndex = Number(slot.element.getAttribute("data-inventory-slot"));
	if (!Number.isInteger(slotIndex)) return null;

	const nodeId = slot.element.getAttribute("data-drag-node-id") ?? inventorySlotNodeId(slotIndex);
	return {
		targetId: nodeId,
		targetNodeId: nodeId,
		target: {
			kind: "inventory-slot",
			slotIndex,
		} satisfies DropTarget,
	} satisfies DropData;
};
