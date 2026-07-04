import { match, P } from "ts-pattern";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { isBoardViewItemRuntimeBusy } from "~/board/view/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/board/view/isBoardViewItemRuntimeStatePreserved";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ItemId } from "~/config/GameIdSchema";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";

export namespace resolveItemToBoardItemInteractionPlan {
	export interface Props {
		config: GameConfig;
		sourceItemId: ItemId | string;
		targetItem: BoardViewItem;
	}
}

type ItemToBoardItemInteractionFacts = {
	canCraft: boolean;
	canMerge: boolean;
	canRemoveTile: boolean;
	canSupplyStashInput: boolean;
	mergeResultItemId?: string;
	producerInputLineId?: string;
	removeConsumesSource: boolean;
};

const readTargetCanBeReplacedByMerge = ({ targetItem }: { targetItem: BoardViewItem }) =>
	!isBoardViewItemRuntimeBusy(targetItem) && !isBoardViewItemRuntimeStatePreserved(targetItem);

const readMergeInteractionFacts = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props) => {
	const mergeRule = resolveExecutableItemMergeRule({
		config,
		sourceItemId,
		targetItemId: targetItem.itemId,
	});
	const mergeResultItemId =
		mergeRule?.merge && "resultItemId" in mergeRule.merge
			? mergeRule.merge.resultItemId
			: undefined;
	return {
		canMerge: Boolean(
			mergeRule &&
				(!mergeResultItemId ||
					readTargetCanBeReplacedByMerge({
						targetItem,
					})),
		),
		mergeResultItemId,
	};
};

const readCraftInputInteractionAvailable = ({
	sourceItemId,
	targetItem,
}: Pick<resolveItemToBoardItemInteractionPlan.Props, "sourceItemId" | "targetItem">) =>
	Boolean(
		targetItem.craft?.canAcceptInputs &&
			targetItem.craft.acceptedInputItemIds.includes(sourceItemId as ItemId),
	);

const readDefaultFirstProducerInputLineId = ({
	sourceItemId,
	targetItem,
}: Pick<resolveItemToBoardItemInteractionPlan.Props, "sourceItemId" | "targetItem">) =>
	(targetItem.activation?.lines ?? [])
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

const readStashInputInteractionAvailable = ({
	sourceItemId,
	targetItem,
}: Pick<resolveItemToBoardItemInteractionPlan.Props, "sourceItemId" | "targetItem">) =>
	Boolean(
		targetItem.activation?.kind === "stash" &&
			targetItem.activation.inputs.some(
				(input) => input.itemId === sourceItemId && input.stored < input.capacity,
			),
	);

const readTileRemoveInteractionFacts = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props) => {
	const removal = config.items[targetItem.itemId]?.removeBy?.find(
		(entry) => entry.itemId === sourceItemId,
	);
	return {
		canRemoveTile: Boolean(removal),
		removeConsumesSource: removal?.mode === "consume",
	};
};

const readItemToBoardItemInteractionFacts = (
	props: resolveItemToBoardItemInteractionPlan.Props,
): ItemToBoardItemInteractionFacts => ({
	...readMergeInteractionFacts(props),
	...readTileRemoveInteractionFacts(props),
	canCraft: readCraftInputInteractionAvailable(props),
	canSupplyStashInput: readStashInputInteractionAvailable(props),
	producerInputLineId: readDefaultFirstProducerInputLineId(props),
});

const createMergeInteractionPlan = ({
	mergeResultItemId,
}: Pick<ItemToBoardItemInteractionFacts, "mergeResultItemId">): ItemToBoardItemInteractionPlan => ({
	...(mergeResultItemId
		? {
				resultItemId: mergeResultItemId,
			}
		: {}),
	type: "merge" as const,
});

export const resolveItemToBoardItemInteractionPlan = (
	props: resolveItemToBoardItemInteractionPlan.Props,
): ItemToBoardItemInteractionPlan =>
	match(readItemToBoardItemInteractionFacts(props))
		.with(
			{
				canMerge: true,
			},
			createMergeInteractionPlan,
		)
		.with(
			{
				canCraft: true,
			},
			() => ({
				consumesSource: true as const,
				feedbackVariant: "secondary" as const,
				type: "craft-input" as const,
			}),
		)
		.with(
			{
				canSupplyStashInput: true,
			},
			() => ({
				consumesSource: true as const,
				feedbackVariant: "secondary" as const,
				type: "stash-input" as const,
			}),
		)
		.with(
			{
				canRemoveTile: true,
			},
			({ removeConsumesSource }) => ({
				consumesSource: removeConsumesSource,
				feedbackVariant: "primary" as const,
				type: "tile-remove" as const,
			}),
		)
		.with(
			{
				producerInputLineId: P.string,
			},
			({ producerInputLineId }) => ({
				consumesSource: true as const,
				feedbackVariant: "secondary" as const,
				lineId: producerInputLineId,
				type: "producer-input" as const,
			}),
		)
		.otherwise(() => ({
			type: "swap" as const,
		}));
