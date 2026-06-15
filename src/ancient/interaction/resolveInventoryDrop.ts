import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
import type { Runtime, TypedDropContext } from "./types";

export namespace resolveInventoryDrop {
	export interface Props {
		context: TypedDropContext<"inventory", "inventory-slot">;
		runtime: Pick<Runtime, "run">;
	}
}

export const resolveInventoryDrop = ({
	context,
	runtime,
}: resolveInventoryDrop.Props): DropPlan<ItemId, VisualTransitionKind, VisualMeta> => {
	const { source, target } = context;
	if (source.source.slotIndex === target.target.slotIndex)
		return {
			type: "ignore",
		};

	return accept({
		hide: [
			source.sourceId,
		],
		commit: (drop) =>
			runtime.run(
				{
					type: "inventory.swap",
					sourceSlotIndex: source.source.slotIndex,
					targetSlotIndex: target.target.slotIndex,
				},
				drop,
			),
	});
};
