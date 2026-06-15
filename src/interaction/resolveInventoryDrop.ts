import type { DropPlan } from "~/drag/DropPlan";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import { visualInventoryStackKey } from "~/play/hook/useVisualItemMotions";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
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
}: resolveInventoryDrop.Props): DropPlan<string, VisualTransitionKind, VisualMeta> => {
	const { source, target } = context;
	if (source.source.slotIndex === target.target.slotIndex)
		return {
			type: "ignore",
		};

	const targetStack = runtime.game.inventoryBySlotIndex[target.target.slotIndex]?.stack;

	return accept({
		hide: [
			source.sourceId,
		],
		animations: [
			{
				itemId: source.itemId,
				actorKey: visualInventoryStackKey(source.source.stackId),
				fromDrag: true,
				toNodeId: inventorySlotNodeId(target.target.slotIndex),
				kind: "move",
			},
			...(targetStack
				? [
						{
							itemId: targetStack.itemId,
							actorKey: visualInventoryStackKey(targetStack.id),
							fromNodeId: inventorySlotNodeId(target.target.slotIndex),
							toNodeId: source.sourceNodeId,
							kind: "move" as const,
						},
					]
				: []),
		],
		commit: () =>
			runtime.run({
				type: "inventory.swap",
				sourceSlotIndex: source.source.slotIndex,
				targetSlotIndex: target.target.slotIndex,
			}),
	});
};
