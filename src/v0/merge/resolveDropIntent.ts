import { match } from "ts-pattern";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";

export type DropIntent =
	| {
			type: "merge";
			resultItemId?: ItemId;
			directed: boolean;
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
			type: "stored-requirement";
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
				directed: plan.directed,
				resultItemId: plan.resultItemId as ItemId | undefined,
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
				type: "stored-requirement",
			},
			() => ({
				type: "stored-requirement" as const,
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
