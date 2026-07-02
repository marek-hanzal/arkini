import { match, P } from "ts-pattern";
import { isBoardViewItemRuntimeBusy } from "~/board/logic/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/board/logic/isBoardViewItemRuntimeStatePreserved";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigSchema";
import { resolveExecutableItemMergeRule } from "~/engine/logic/resolveExecutableItemMergeRule";
import type { ItemId } from "~/config/GameIdSchema";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";

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
	const producerInputLineId = (targetItem.activation?.lines ?? [])
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
		)?.line.lineId;
	const canSupplyStashInput = Boolean(
		targetItem.activation?.kind === "stash" &&
			targetItem.activation.inputs.some(
				(input) => input.itemId === sourceItemId && input.stored < input.capacity,
			),
	);
	const canRemoveTile = Boolean(
		config.items[targetItem.itemId]?.removeBy?.some((entry) => entry.itemId === sourceItemId),
	);

	return match({
		canCraft,
		canMerge,
		canRemoveTile,
		canSupplyStashInput,
		mergeRule,
		producerInputLineId,
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
				canRemoveTile: true,
			},
			() => ({
				feedbackVariant: "primary" as const,
				type: "tile-remove" as const,
			}),
		)
		.with(
			{
				producerInputLineId: P.string,
			},
			({ producerInputLineId }) => ({
				feedbackVariant: "secondary" as const,
				lineId: producerInputLineId,
				type: "producer-input" as const,
			}),
		)
		.otherwise(() => ({
			type: "swap" as const,
		}));
};
