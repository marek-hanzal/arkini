import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import { visualBoardItemKey } from "~/play/hook/useVisualItemMotions";
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
	context: { source, target },
	runtime,
}: resolveBoardInventoryDrop.Props): DropPlan<ItemId, VisualTransitionKind, VisualMeta> =>
	accept({
		animationTiming: "beforeCommit",
		hide: [
			source.sourceId,
		],
		animations: [
			{
				itemId: source.itemId,
				actorKey: visualBoardItemKey(source.source.boardItemId),
				fromDrag: true,
				toNodeId: target.targetNodeId,
				kind: "exit",
			},
		],
		commit: () =>
			runtime.run({
				type: "inventory.stash",
				boardItemId: source.source.boardItemId,
			}),
		feedback: () => pulseBottomNav("inventory"),
	});
