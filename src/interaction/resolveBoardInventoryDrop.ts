import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import { pulseBottomNav } from "~/play/hook/pulseBottomNav";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
import type { Runtime, TypedDropContext } from "./types";

export namespace resolveBoardInventoryDrop {
	export interface Props {
		context: TypedDropContext<"board", "inventory">;
		runtime: Pick<Runtime, "run">;
	}
}

export const resolveBoardInventoryDrop = ({
	context: { source },
	runtime,
}: resolveBoardInventoryDrop.Props): DropPlan<ItemId, VisualTransitionKind, VisualMeta> =>
	accept({
		hide: [
			source.sourceId,
		],
		commit: (drop) =>
			runtime.run(
				{
					type: "inventory.stash",
					boardItemId: source.source.boardItemId,
				},
				drop,
			),
		feedback: () => pulseBottomNav("inventory"),
	});
