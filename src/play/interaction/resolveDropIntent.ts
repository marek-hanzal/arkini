import { match } from "ts-pattern";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ItemId } from "~/config/GameIdSchema";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";

export type DropIntent =
	| {
			type: "merge";
			resultItemId?: ItemId;
	  }
	| {
			type: "craft-input";
	  }
	| {
			type: "producer-input";
	  }
	| {
			type: "stash-input";
	  }
	| {
			type: "tile-remove";
	  }
	| {
			type: "swap";
	  }
	| {
			type: "reject";
	  };

export namespace resolveDropIntent {
	export interface Props {
		config: GameConfig;
		sourceItemId: ItemId | string;
		targetItem: BoardViewItem;
	}
}

export const resolveDropIntent = ({
	config,
	sourceItemId,
	targetItem,
}: resolveDropIntent.Props): DropIntent =>
	match(
		resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId,
			targetItem,
		}),
	)
		.with(
			{
				type: "merge",
			},
			(plan) => ({
				resultItemId: plan.resultItemId,
				type: "merge" as const,
			}),
		)
		.with(
			{
				type: "craft-input",
			},
			() => ({
				type: "craft-input" as const,
			}),
		)
		.with(
			{
				type: "producer-input",
			},
			() => ({
				type: "producer-input" as const,
			}),
		)
		.with(
			{
				type: "stash-input",
			},
			() => ({
				type: "stash-input" as const,
			}),
		)
		.with(
			{
				type: "tile-remove",
			},
			() => ({
				type: "tile-remove" as const,
			}),
		)
		.with(
			{
				type: "swap",
			},
			() => ({
				type: "swap" as const,
			}),
		)
		.with(
			{
				type: "reject",
			},
			() => ({
				type: "reject" as const,
			}),
		)
		.exhaustive();
