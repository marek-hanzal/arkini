import { match } from "ts-pattern";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import type { DropPlan } from "~/drag/DropPlan";
import type { GameDragView } from "~/drag/view/GameDragViewSchema";
import type { ItemId } from "~/manifest/manifestId";
import type { VisualMeta, VisualTransitionKind } from "~/play/types";
import { flashDrop } from "./flashDrop";
import { reject } from "./reject";
import { resolveBoardDrop } from "./resolveBoardDrop";
import { resolveBoardInventoryDrop } from "./resolveBoardInventoryDrop";
import { resolveInventoryDrop } from "./resolveInventoryDrop";
import type { AnyDropContext, Feedback, TypedDropContext } from "./types";

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
	if (!game || !context.target) {
		return reject(() =>
			flashDrop({
				context,
				game,
				feedback,
			}),
		);
	}

	const source = context.source.source;
	const target = context.target.target;
	const runtime = {
		game,
		feedback,
		run,
	};

	return match({
		source: source.kind,
		target: target.kind,
	})
		.with(
			{
				source: "board",
				target: "inventory",
			},
			() =>
				resolveBoardInventoryDrop({
					context: context as TypedDropContext<"board", "inventory">,
					runtime,
				}),
		)
		.with(
			{
				source: "inventory",
				target: "inventory-slot",
			},
			() =>
				resolveInventoryDrop({
					context: context as TypedDropContext<"inventory", "inventory-slot">,
					runtime,
				}),
		)
		.with(
			{
				source: "board",
				target: "cell",
			},
			() =>
				resolveBoardDrop({
					context: context as TypedDropContext<"board", "cell">,
					runtime,
				}),
		)
		.otherwise(() =>
			reject(() =>
				flashDrop({
					context,
					game,
					feedback,
				}),
			),
		);
};
