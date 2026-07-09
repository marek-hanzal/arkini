import type { GameAction } from "~/action/GameActionSchema";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { isBoardViewItemRuntimeBusy } from "~/board/view/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/board/view/isBoardViewItemRuntimeStatePreserved";
import { readBoardViewItemQuantity } from "~/board/view/readBoardViewItemQuantity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ItemId } from "~/config/GameIdSchema";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";
import { readAcceptedTransferQuantity } from "~/quantity/readAcceptedTransferQuantity";
import { readItemInteractionProfile } from "~/item/ItemInteractionProfile";

export namespace resolveItemToBoardItemInteractionPlan {
	export interface Props {
		config: GameConfig;
		sourceItemId: ItemId | string;
		sourceQuantity?: number;
		targetItem: BoardViewItem;
	}
}

const readTargetCanBeReplacedByMerge = ({ targetItem }: { targetItem: BoardViewItem }) =>
	!isBoardViewItemRuntimeBusy(targetItem) && !isBoardViewItemRuntimeStatePreserved(targetItem);

const readSourceQuantity = ({
	sourceQuantity,
}: Pick<resolveItemToBoardItemInteractionPlan.Props, "sourceQuantity">) => sourceQuantity ?? 1;

const readConsumedQuantity = ({
	availableQuantity,
	remainingCapacity,
}: {
	availableQuantity: number;
	remainingCapacity: number;
}) =>
	readAcceptedTransferQuantity({
		availableQuantity,
		remainingCapacity,
	});

const withSourceQuantity = ({
	quantity,
	sourceRef,
}: {
	quantity: number;
	sourceRef: GameActionItemRef;
}): GameActionItemRef => ({
	...sourceRef,
	quantity,
});

const readMergeInteractionPlan = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan | undefined => {
	const sourceProfile = readItemInteractionProfile({
		config,
		itemId: sourceItemId,
	});
	if (
		!sourceProfile.hasExplicitMergeRules ||
		!sourceProfile.mergeTargetIds.includes(targetItem.itemId)
	) {
		return undefined;
	}

	const mergeRule = resolveExecutableItemMergeRule({
		config,
		sourceItemId,
		targetItemId: targetItem.itemId,
	});
	if (!mergeRule) return undefined;

	const mergeResultItemId =
		mergeRule.merge && "resultItemId" in mergeRule.merge
			? mergeRule.merge.resultItemId
			: undefined;
	if (
		mergeResultItemId &&
		!readTargetCanBeReplacedByMerge({
			targetItem,
		})
	) {
		return undefined;
	}

	return mergeResultItemId
		? {
				resultItemId: mergeResultItemId,
				type: "merge",
			}
		: {
				type: "merge",
			};
};

const readStackInteractionPlan = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan | undefined => {
	const sourceProfile = readItemInteractionProfile({
		config,
		itemId: sourceItemId,
	});
	const targetProfile = readItemInteractionProfile({
		config,
		itemId: targetItem.itemId,
	});
	if (!sourceProfile.stackKey || sourceProfile.stackKey !== targetProfile.stackKey)
		return undefined;
	if (
		isBoardViewItemRuntimeBusy(targetItem) ||
		isBoardViewItemRuntimeStatePreserved(targetItem)
	) {
		return undefined;
	}

	const maxStackSize = targetProfile.stackKey
		? (config.items[targetItem.itemId]?.maxStackSize ?? 1)
		: 1;
	if (readBoardViewItemQuantity(targetItem) >= maxStackSize) {
		return undefined;
	}

	return {
		type: "stack",
	};
};

const readCraftInputInteractionPlan = ({
	config,
	sourceItemId,
	sourceQuantity,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan | undefined => {
	const targetProfile = readItemInteractionProfile({
		config,
		itemId: targetItem.itemId,
	});
	if (
		(!targetProfile.acceptsCraftInput && !targetItem.craft) ||
		!targetItem.craft?.canAcceptInputs ||
		!targetItem.craft.acceptedInputItemIds.includes(sourceItemId as ItemId)
	) {
		return undefined;
	}

	const input = targetItem.craft.inputs.find((entry) => entry.itemId === sourceItemId);
	if (!input) return undefined;

	const deliveredQuantity = targetItem.craft.delivered[sourceItemId] ?? 0;
	const consumedQuantity = readConsumedQuantity({
		availableQuantity: readSourceQuantity({
			sourceQuantity,
		}),
		remainingCapacity: input.quantity - deliveredQuantity,
	});
	if (consumedQuantity <= 0) return undefined;

	return {
		consumedQuantity,
		consumesSource: true,
		feedbackVariant: "secondary",
		type: "craft-input",
	};
};

const readStashInputInteractionPlan = ({
	config,
	sourceItemId,
	sourceQuantity,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan | undefined => {
	const targetProfile = readItemInteractionProfile({
		config,
		itemId: targetItem.itemId,
	});
	if (!targetProfile.acceptsStashInput && targetItem.activation?.kind !== "stash")
		return undefined;

	const input =
		targetItem.activation?.kind === "stash"
			? targetItem.activation.inputs.find(
					(entry) => entry.itemId === sourceItemId && entry.stored < entry.capacity,
				)
			: undefined;
	if (!input) return undefined;

	const consumedQuantity = readConsumedQuantity({
		availableQuantity: readSourceQuantity({
			sourceQuantity,
		}),
		remainingCapacity: input.capacity - input.stored,
	});
	if (consumedQuantity <= 0) return undefined;

	return {
		consumedQuantity,
		consumesSource: true,
		feedbackVariant: "secondary",
		type: "stash-input",
	};
};

const readTileRemoveInteractionPlan = ({
	config,
	sourceItemId,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan | undefined => {
	const targetProfile = readItemInteractionProfile({
		config,
		itemId: targetItem.itemId,
	});
	if (!targetProfile.removableByItemIds.includes(sourceItemId as ItemId)) return undefined;

	const removal = config.items[targetItem.itemId]?.removeBy?.find(
		(entry) => entry.itemId === sourceItemId,
	);
	if (!removal) return undefined;

	return {
		consumedQuantity: removal.mode === "consume" ? 1 : 0,
		consumesSource: removal.mode === "consume",
		feedbackVariant: "primary",
		type: "tile-remove",
	};
};

const readProducerInputInteractionPlan = ({
	config,
	sourceItemId,
	sourceQuantity,
	targetItem,
}: resolveItemToBoardItemInteractionPlan.Props): ItemToBoardItemInteractionPlan | undefined => {
	const targetProfile = readItemInteractionProfile({
		config,
		itemId: targetItem.itemId,
	});
	if (!targetProfile.acceptsProducerInput && targetItem.activation?.kind !== "producer")
		return undefined;

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
	if (!candidate) return undefined;

	const consumedQuantity = readConsumedQuantity({
		availableQuantity: readSourceQuantity({
			sourceQuantity,
		}),
		remainingCapacity: candidate.input.capacity - candidate.input.stored,
	});
	if (consumedQuantity <= 0) return undefined;

	return {
		consumedQuantity,
		consumesSource: true,
		feedbackVariant: "secondary",
		lineId: candidate.line.lineId,
		type: "producer-input",
	};
};

const readInputInteractionPlan = (
	props: resolveItemToBoardItemInteractionPlan.Props,
): ItemToBoardItemInteractionPlan | undefined =>
	readCraftInputInteractionPlan(props) ??
	readStashInputInteractionPlan(props) ??
	readTileRemoveInteractionPlan(props) ??
	readProducerInputInteractionPlan(props);

export const resolveItemToBoardItemInteractionPlan = (
	props: resolveItemToBoardItemInteractionPlan.Props,
): ItemToBoardItemInteractionPlan =>
	readMergeInteractionPlan(props) ??
	readStackInteractionPlan(props) ??
	readInputInteractionPlan(props) ?? {
		type: "swap",
	};

const readItemInteractionSourceRef = ({
	plan,
	sourceRef,
}: {
	plan: ItemToBoardItemInteractionPlan;
	sourceRef: GameActionItemRef;
}): GameActionItemRef => {
	if (!("consumedQuantity" in plan) || !plan.consumesSource) return sourceRef;

	return withSourceQuantity({
		quantity: plan.consumedQuantity,
		sourceRef,
	});
};

const readItemInteractionAction = ({
	plan,
	sourceRef,
	targetItemInstanceId,
}: {
	plan: ItemToBoardItemInteractionPlan;
	sourceRef: GameActionItemRef;
	targetItemInstanceId: string;
}): GameAction | undefined => {
	switch (plan.type) {
		case "merge":
			return {
				sourceRef,
				targetItemInstanceId,
				type: "item.merge",
			};
		case "stack":
			return {
				sourceRef,
				targetItemInstanceId,
				type: "item.stack",
			};
		case "craft-input":
			return {
				inputRef: sourceRef,
				targetItemInstanceId,
				type: "craft.input.store",
			};
		case "producer-input":
			return {
				inputRef: sourceRef,
				itemInstanceId: targetItemInstanceId,
				lineId: plan.lineId,
				type: "producer.input.store",
			};
		case "stash-input":
			return {
				inputRefs: [
					sourceRef,
				],
				stashItemInstanceId: targetItemInstanceId,
				type: "stash.open",
			};
		case "tile-remove":
			return {
				targetItemInstanceId,
				toolRef: sourceRef,
				type: "tile.remove",
			};
		case "reject":
		case "swap":
			return undefined;
	}
};

export const readItemToBoardItemInteractionCommit = ({
	plan,
	sourceRef,
	targetItemInstanceId,
}: {
	plan: ItemToBoardItemInteractionPlan;
	sourceRef: GameActionItemRef;
	targetItemInstanceId: string;
}): {
	action: GameAction | undefined;
	sourceRef: GameActionItemRef;
} => {
	const interactionSourceRef = readItemInteractionSourceRef({
		plan,
		sourceRef,
	});

	return {
		action: readItemInteractionAction({
			plan,
			sourceRef: interactionSourceRef,
			targetItemInstanceId,
		}),
		sourceRef: interactionSourceRef,
	};
};
