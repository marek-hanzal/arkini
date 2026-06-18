import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import {
	hasReverseDirectedItemMergeRule,
	resolveExecutableItemMergeRule,
} from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";

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
}: resolveDropIntent.Props): DropIntent => {
	const mergeRule = resolveExecutableItemMergeRule({
		config,
		sourceItemId,
		targetItemId: targetItem.itemId,
	});
	const reverseDirectedMerge = hasReverseDirectedItemMergeRule({
		config,
		sourceItemId,
		targetItemId: targetItem.itemId,
	});
	const canMerge = Boolean(
		mergeRule && (!targetItem.craft || targetItem.craft.phase === "collecting_inputs"),
	);
	const canCraft = Boolean(
		targetItem.craft?.canAcceptInputs &&
			targetItem.craft.acceptedInputItemIds.includes(sourceItemId as ItemId),
	);
	const canSupplyProducer = Boolean(
		targetItem.activation?.productLines?.some(
			(line) =>
				line.enabled &&
				line.inputs.some(
					(input) => input.itemId === sourceItemId && input.stored < input.capacity,
				),
		),
	);
	const canSupplyStoredRequirement = Boolean(
		targetItem.activation?.requirements.some(
			(requirement) =>
				requirement.type === "stored" &&
				requirement.itemId === sourceItemId &&
				requirement.stored < requirement.capacity,
		) ||
			targetItem.activation?.productLines?.some(
				(line) => line.enabled && line.missingRequirementItemIds.includes(sourceItemId),
			) ||
			targetItem.craft?.requirements?.some(
				(requirement) =>
					requirement.type === "stored" &&
					requirement.itemId === sourceItemId &&
					requirement.stored < requirement.capacity,
			),
	);

	if (reverseDirectedMerge) {
		return {
			type: "reject",
		};
	}

	if (canMerge) {
		return {
			type: "merge",
			resultItemId: mergeRule?.merge.resultItemId as ItemId | undefined,
			directed: mergeRule?.directed ?? false,
		};
	}

	if (canSupplyStoredRequirement) {
		return {
			type: "stored-requirement",
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
