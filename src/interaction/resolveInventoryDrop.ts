import type { DropPlan } from "~/drag/DropPlan";
import type { FlyerKind, VisualMeta } from "~/play/types";
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
}: resolveInventoryDrop.Props): DropPlan<string, FlyerKind, VisualMeta> => {
	const { source, target } = context;
	if (source.source.slotIndex === target.target.slotIndex)
		return {
			type: "ignore",
		};

	return accept({
		commit: () =>
			runtime.run({
				type: "inventory.swap",
				sourceSlotIndex: source.source.slotIndex,
				targetSlotIndex: target.target.slotIndex,
			}),
	});
};
