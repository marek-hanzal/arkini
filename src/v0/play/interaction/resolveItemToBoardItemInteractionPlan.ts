import { match, P } from "ts-pattern";
import { isBoardViewItemRuntimeBusy } from "~/v0/board/logic/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/v0/board/logic/isBoardViewItemRuntimeStatePreserved";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { resolveExecutableItemMergeRule } from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { ItemToBoardItemInteractionPlan } from "~/v0/play/interaction/ItemToBoardItemInteractionPlan";

export namespace resolveItemToBoardItemInteractionPlan {
	export interface Props {
		config: GameConfig;
		sourceItemId: ItemId | string;
		targetItem: BoardViewItem;
	}
}

export const resolveItemToBoardItemInteractionPlan = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan => {
	const mergeRule = resolveExecutableItemMergeRule({
		config,
		sourceItemId,
		targetItemId: targetItem.itemId,
	});
	const canReplaceTarget =
		!isBoardViewItemRuntimeBusy(targetItem) &&
		!isBoardViewItemRuntimeStatePreserved(targetItem);
	const canMerge = Boolean(mergeRule && canReplaceTarget);
	const canCraft = Boolean(
		targetItem.craft?.canAcceptInputs &&
			targetItem.craft.acceptedInputItemIds.includes(sourceItemId as ItemId),
	);
	const producerInputProductId = (targetItem.activation?.productLines ?? [])
		.map((line, index) => ({
			index,
			line,
		}))
		.sort(
			(left, right) =>
				Number(right.line.isDefault) - Number(left.line.isDefault) ||
				left.index - right.index,
		)
		.find(({ line }) =>
			line.inputs.some(
				(input) => input.itemId === sourceItemId && input.stored < input.capacity,
			),
		)?.line.productId;
	const canSupplyStashInput = Boolean(
		targetItem.activation?.kind === "stash" &&
			targetItem.activation.inputs.some(
				(input) => input.itemId === sourceItemId && input.stored < input.capacity,
			),
	);

	return match({
		canCraft,
		canMerge,
		canSupplyStashInput,
		mergeRule,
		producerInputProductId,
	})
		.with(
			{
				canMerge: true,
			},
			({ mergeRule }) => ({
				resultItemId: mergeRule?.merge.resultItemId,
				type: "merge" as const,
			}),
		)
		.with(
			{
				canCraft: true,
			},
			() => ({
				feedbackVariant: "secondary" as const,
				type: "craft-input" as const,
			}),
		)
		.with(
			{
				canSupplyStashInput: true,
			},
			() => ({
				feedbackVariant: "secondary" as const,
				type: "stash-input" as const,
			}),
		)
		.with(
			{
				producerInputProductId: P.string,
			},
			({ producerInputProductId }) => ({
				feedbackVariant: "secondary" as const,
				productId: producerInputProductId,
				type: "producer-input" as const,
			}),
		)
		.otherwise(() => ({
			type: "swap" as const,
		}));
};
