import type { DropPlan } from "~/drag/DropPlan";
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
}: resolveBoardInventoryDrop.Props): DropPlan<string, VisualTransitionKind, VisualMeta> =>
	accept({
		commit: () =>
			runtime.run({
				type: "inventory.stash",
				boardItemId: source.source.boardItemId,
			}),
		feedback: () => pulseBottomNav("inventory"),
	});
