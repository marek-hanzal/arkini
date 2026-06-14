import type { DropPlan } from "~/drag/DropPlan";
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
}: resolveBoardInventoryDrop.Props): DropPlan<string, VisualTransitionKind, VisualMeta> =>
	accept({
		animationTiming: "beforeCommit",
		animations: [
			{
				itemId: source.itemId,
				actorKey: visualBoardItemKey(source.source.boardItemId),
				fromDrag: true,
				toNodeId: target.targetNodeId,
				kind: "stash",
			},
		],
		commit: () =>
			runtime.run({
				type: "inventory.stash",
				boardItemId: source.source.boardItemId,
			}),
		feedback: () => pulseBottomNav("inventory"),
	});
