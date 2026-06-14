import type { DropPlan } from "~/drag/hook/useDraggableControl";
import type { FlyerKind, VisualMeta } from "~/play/types";
import { flashDrop } from "./flashDrop";
import { reject } from "./reject";
import { resolveBoardDrop } from "./resolveBoardDrop";
import { resolveInventoryDrop } from "./resolveInventoryDrop";
import type { AnyDropContext, Feedback, TypedDropContext } from "./types";
import type { Command } from "~/action/command";
import type { GameDragView } from "~/play/logic/playTypes";

export namespace resolveDrop {
	export interface Props {
		context: AnyDropContext;
		game: GameDragView | undefined;
		feedback: Feedback;
		run(command: Command): Promise<unknown>;
	}
}

export const resolveDrop = ({
	context,
	game,
	feedback,
	run,
}: resolveDrop.Props): DropPlan<string, FlyerKind, VisualMeta> => {
	if (!game || !context.target)
		return reject(() =>
			flashDrop({
				context,
				game,
				feedback,
			}),
		);

	const source = context.source.source;
	const target = context.target.target;
	const route = `${source.kind}->${target.kind}`;
	const runtime = {
		game,
		feedback,
		run,
	};

	switch (route) {
		case "inventory->inventory-slot":
			return resolveInventoryDrop({
				context: context as TypedDropContext<"inventory", "inventory-slot">,
				runtime,
			});
		case "board->cell":
			return resolveBoardDrop({
				context: context as TypedDropContext<"board", "cell">,
				runtime,
			});
		default:
			return reject(() =>
				flashDrop({
					context,
					game,
					feedback,
				}),
			);
	}
};
