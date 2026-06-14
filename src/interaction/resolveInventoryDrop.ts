import type { DropPlan } from "~/drag/DropPlan";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import type { FlyerKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
import { inventoryMoveAnimations } from "./inventoryMoveAnimations";
import type { Runtime, TypedDropContext } from "./types";

export namespace resolveInventoryDrop {
	export interface Props {
		context: TypedDropContext<"inventory", "inventory-slot">;
		runtime: Pick<Runtime, "game" | "run">;
	}
}

export const resolveInventoryDrop = ({
	context,
	runtime,
}: resolveInventoryDrop.Props): DropPlan<string, FlyerKind, VisualMeta> => {
	const { source, target } = context;
	if (source.source.slotIndex === target.target.slotIndex)
		return {
			type: "ignore",
		};

	const targetStack = runtime.game.inventoryBySlotIndex[target.target.slotIndex]?.stack;
	const animations = inventoryMoveAnimations({
		context,
		targetStack,
	});
	const hide = [
		source.sourceId,
		...(targetStack
			? [
					inventorySourceId(target.target.slotIndex),
				]
			: []),
	];

	return accept({
		hide,
		animations,
		commit: () =>
			runtime.run({
				type: "inventory.swap",
				sourceSlotIndex: source.source.slotIndex,
				targetSlotIndex: target.target.slotIndex,
			}),
	});
};
