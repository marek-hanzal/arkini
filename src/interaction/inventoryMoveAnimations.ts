import type { DraggableAnimation } from "~/drag/hook/useDraggableControl";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import type { FlyerKind, VisualMeta } from "~/play/types";
import { dragToTargetAnimation } from "./dragToTargetAnimation";
import type { TypedDropContext } from "./types";

export namespace inventoryMoveAnimations {
	export interface Props {
		context: TypedDropContext<"inventory", "inventory-slot">;
		targetStack:
			| {
					itemId: string;
					quantity: number;
			  }
			| undefined;
	}
}

export const inventoryMoveAnimations = ({
	context,
	targetStack,
}: inventoryMoveAnimations.Props): DraggableAnimation<string, FlyerKind, VisualMeta>[] => {
	const { source, target } = context;
	const animations: DraggableAnimation<string, FlyerKind, VisualMeta>[] = [
		dragToTargetAnimation({
			source,
			target,
		}),
	];

	if (targetStack) {
		animations.push({
			itemId: targetStack.itemId,
			fromNodeId: target.targetNodeId,
			toNodeId: inventorySlotNodeId(source.source.slotIndex),
			overlay: {
				quantity: targetStack.quantity,
			},
		});
	}

	return animations;
};
