import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";
import { flashDrop } from "./flashDrop";
import { reject } from "./reject";
import { resolveBoardDrop } from "./resolveBoardDrop";
import { resolveBoardInventoryDrop } from "./resolveBoardInventoryDrop";
import { resolveInventoryDrop } from "./resolveInventoryDrop";
import type { AnyDropContext, Feedback, TypedDropContext } from "./types";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import type { GameDragView } from "~/drag/view/GameDragViewSchema";

export namespace resolveDrop {
	export interface Props {
		context: AnyDropContext;
		game: GameDragView | undefined;
		feedback: Feedback;
		run(command: Command): Promise<CommandResult>;
	}
}

export const resolveDrop = ({
	context,
	game,
	feedback,
	run,
}: resolveDrop.Props): DropPlan<ItemId, VisualTransitionKind, VisualMeta> => {
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
		case "board->inventory":
			return resolveBoardInventoryDrop({
				context: context as TypedDropContext<"board", "inventory">,
				runtime,
			});
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
