import { match, P } from "ts-pattern";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { isBoardViewItemRuntimeBusy } from "~/board/view/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/board/view/isBoardViewItemRuntimeStatePreserved";
import { readBoardViewItemQuantity } from "~/board/view/readBoardViewItemQuantity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ItemId } from "~/config/GameIdSchema";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";

export namespace resolveItemToBoardItemInteractionPlan {
	export interface Props {
		config: GameConfig;
		sourceItemId: ItemId | string;
		sourceQuantity?: number;
		targetItem: BoardViewItem;
	}
}

type ItemToBoardItemInteractionFacts = {
	canCraft: boolean;
	canMerge: boolean;
	canRemoveTile: boolean;
	canStack: boolean;
	canSupplyStashInput: boolean;
	craftConsumedQuantity: number;
	mergeResultItemId?: string;
	producerConsumedQuantity: number;
	producerInputLineId?: string;
	removeConsumesSource: boolean;
	removeConsumedQuantity: number;
	stashConsumedQuantity: number;
};

const readTargetCanBeReplacedByMerge = ({ targetItem }: { targetItem: BoardViewItem }) =>
	!isBoardViewItemRuntimeBusy(targetItem) && !isBoardViewItemRuntimeStatePreserved(targetItem);

const readSourceQuantity = ({
	sourceQuantity,
}: Pick<resolveItemToBoardItemInteractionPlan.Props, "sourceQuantity">) => sourceQuantity ?? 1;

const readAcceptedQuantity = ({
	remainingQuantity,
	sourceQuantity,
}: {
	remainingQuantity: number;
	sourceQuantity: number;
}) => Math.max(0, Math.min(sourceQuantity, remainingQuantity));

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

const readStackInteractionAvailable = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props) => {
	if (sourceItemId !== targetItem.itemId) return false;
	if (
		isBoardViewItemRuntimeBusy(targetItem) ||
		isBoardViewItemRuntimeStatePreserved(targetItem)
	) {
		return false;
	}

	const maxStackSize = config.items[targetItem.itemId]?.maxStackSize ?? 1;
	return maxStackSize > 1 && readBoardViewItemQuantity(targetItem) < maxStackSize;
};

const readCraftInputInteractionFacts = ({
	sourceItemId,
	sourceQuantity,
	targetItem,
}: Pick<
	resolveItemToBoardItemInteractionPlan.Props,
	"sourceItemId" | "sourceQuantity" | "targetItem"
>) => {
	const input = targetItem.craft?.inputs.find((entry) => entry.itemId === sourceItemId);
	const deliveredQuantity = targetItem.craft?.delivered[sourceItemId] ?? 0;
	const consumedQuantity = input
		? readAcceptedQuantity({
				remainingQuantity: input.quantity - deliveredQuantity,
				sourceQuantity: readSourceQuantity({
					sourceQuantity,
				}),
			})
		: 0;

	return {
		canCraft: Boolean(
			targetItem.craft?.canAcceptInputs &&
				targetItem.craft.acceptedInputItemIds.includes(sourceItemId as ItemId) &&
				consumedQuantity > 0,
		),
		craftConsumedQuantity: consumedQuantity,
	};
};

const readDefaultFirstProducerInputFacts = ({
	sourceItemId,
	sourceQuantity,
	targetItem,
}: Pick<
	resolveItemToBoardItemInteractionPlan.Props,
	"sourceItemId" | "sourceQuantity" | "targetItem"
>) => {
	const candidate = (targetItem.activation?.lines ?? [])
		.map((line, index) => ({
			index,
			line,
		}))
		.sort(
			(left, right) =>
				Number(right.line.isDefault) - Number(left.line.isDefault) ||
				left.index - right.index,
		)
		.flatMap(({ line }) =>
			line.inputs.map((input) => ({
				input,
				line,
			})),
		)
		.find(({ input }) => input.itemId === sourceItemId && input.stored < input.capacity);
	const consumedQuantity = candidate
		? readAcceptedQuantity({
				remainingQuantity: candidate.input.capacity - candidate.input.stored,
				sourceQuantity: readSourceQuantity({
					sourceQuantity,
				}),
			})
		: 0;

	return {
		producerConsumedQuantity: consumedQuantity,
		producerInputLineId: consumedQuantity > 0 ? candidate?.line.lineId : undefined,
	};
};

const readStashInputInteractionFacts = ({
	sourceItemId,
	sourceQuantity,
	targetItem,
}: Pick<
	resolveItemToBoardItemInteractionPlan.Props,
	"sourceItemId" | "sourceQuantity" | "targetItem"
>) => {
	const input =
		targetItem.activation?.kind === "stash"
			? targetItem.activation.inputs.find(
					(entry) => entry.itemId === sourceItemId && entry.stored < entry.capacity,
				)
			: undefined;
	const consumedQuantity = input
		? readAcceptedQuantity({
				remainingQuantity: input.capacity - input.stored,
				sourceQuantity: readSourceQuantity({
					sourceQuantity,
				}),
			})
		: 0;

	return {
		canSupplyStashInput: consumedQuantity > 0,
		stashConsumedQuantity: consumedQuantity,
	};
};

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
		removeConsumedQuantity: removal?.mode === "consume" ? 1 : 0,
		removeConsumesSource: removal?.mode === "consume",
	};
};

const readItemToBoardItemInteractionFacts = (
	props: resolveItemToBoardItemInteractionPlan.Props,
): ItemToBoardItemInteractionFacts => ({
	...readMergeInteractionFacts(props),
	...readCraftInputInteractionFacts(props),
	...readDefaultFirstProducerInputFacts(props),
	...readStashInputInteractionFacts(props),
	...readTileRemoveInteractionFacts(props),
	canStack: readStackInteractionAvailable(props),
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
				canStack: true,
			},
			() => ({
				type: "stack" as const,
			}),
		)
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
			({ craftConsumedQuantity }) => ({
				consumedQuantity: craftConsumedQuantity,
				consumesSource: true as const,
				feedbackVariant: "secondary" as const,
				type: "craft-input" as const,
			}),
		)
		.with(
			{
				canSupplyStashInput: true,
			},
			({ stashConsumedQuantity }) => ({
				consumedQuantity: stashConsumedQuantity,
				consumesSource: true as const,
				feedbackVariant: "secondary" as const,
				type: "stash-input" as const,
			}),
		)
		.with(
			{
				canRemoveTile: true,
			},
			({ removeConsumedQuantity, removeConsumesSource }) => ({
				consumedQuantity: removeConsumedQuantity,
				consumesSource: removeConsumesSource,
				feedbackVariant: "primary" as const,
				type: "tile-remove" as const,
			}),
		)
		.with(
			{
				producerInputLineId: P.string,
			},
			({ producerConsumedQuantity, producerInputLineId }) => ({
				consumedQuantity: producerConsumedQuantity,
				consumesSource: true as const,
				feedbackVariant: "secondary" as const,
				lineId: producerInputLineId,
				type: "producer-input" as const,
			}),
		)
		.otherwise(() => ({
			type: "swap" as const,
		}));
