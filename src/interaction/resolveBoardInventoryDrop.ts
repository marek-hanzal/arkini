import type { DropPlan } from "~/drag/DropPlan";
import { pulseBottomNav } from "~/play/hook/pulseBottomNav";
import type { FlyerKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
import { dragToTargetAnimation } from "./dragToTargetAnimation";
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
}: resolveBoardInventoryDrop.Props): DropPlan<string, FlyerKind, VisualMeta> =>
	accept({
		hide: [
			source.sourceId,
		],
		animations: [
			dragToTargetAnimation({
				source,
				target,
				kind: "stash",
			}),
		],
		commit: () =>
			runtime.run({
				type: "inventory.stash",
				boardItemId: source.source.boardItemId,
			}),
		feedback: () => pulseBottomNav("inventory"),
	});
