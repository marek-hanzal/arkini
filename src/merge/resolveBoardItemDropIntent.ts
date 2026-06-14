import type { ItemId } from "~/manifest/manifestId";
import { resolveItemMergeRule } from "~/manifest/logic/resolveItemMergeRule";
import type { BoardViewItem } from "~/play/logic/playTypes";

export type BoardItemDropIntent =
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
			type: "swap";
	  }
	| {
			type: "reject";
	  };

export namespace resolveBoardItemDropIntent {
	export interface Props {
		sourceItemId: ItemId;
		targetItem: BoardViewItem;
	}
}

export const resolveBoardItemDropIntent = ({
	sourceItemId,
	targetItem,
}: resolveBoardItemDropIntent.Props): BoardItemDropIntent => {
	const mergeRule = resolveItemMergeRule(sourceItemId, targetItem.itemId as ItemId);
	const isDirectedMerge = mergeRule?.consumeSource === false;
	const isForwardDirectedMerge = Boolean(
		isDirectedMerge &&
			sourceItemId === mergeRule?.sourceItemId &&
			targetItem.itemId === mergeRule?.withItemId,
	);
	const canMerge = Boolean(
		mergeRule &&
			(!targetItem.craft || targetItem.craft.phase === "collecting_inputs") &&
			(!isDirectedMerge || isForwardDirectedMerge),
	);
	const canCraft = Boolean(
		targetItem.craft?.canAcceptInputs &&
			targetItem.craft.acceptedInputItemIds.includes(sourceItemId),
	);
	const canSupplyProducer = Boolean(
		targetItem.activation?.inputs.some(
			(input) => input.itemId === sourceItemId && input.stored < input.capacity,
		),
	);

	if (isDirectedMerge && !isForwardDirectedMerge) {
		return {
			type: "reject",
		};
	}

	if (canMerge) {
		return {
			type: "merge",
			resultItemId: mergeRule?.resultItemId,
			directed: Boolean(isDirectedMerge),
		};
	}

	if (canCraft) {
		return {
			type: "craft-input",
		};
	}

	if (canSupplyProducer) {
		return {
			type: "producer-input",
		};
	}

	return {
		type: "swap",
	};
};
