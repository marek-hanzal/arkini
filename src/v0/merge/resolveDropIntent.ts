import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemId } from "~/v0/manifest/manifestId";

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

const resolveRuntimeMergeRule = ({
	config,
	sourceItemId,
	targetItemId,
}: {
	config: GameConfig;
	sourceItemId: string;
	targetItemId: string;
}) => {
	const sourceItem = config.items[sourceItemId];
	if (!sourceItem) return undefined;

	return (sourceItem.mergeIds ?? [])
		.map((mergeId) => config.merge[mergeId])
		.find((rule) => rule?.withItemId === targetItemId);
};

const hasReverseDirectedMergeRule = ({
	config,
	sourceItemId,
	targetItemId,
}: {
	config: GameConfig;
	sourceItemId: string;
	targetItemId: string;
}) => {
	const targetItemDefinition = config.items[targetItemId];
	if (!targetItemDefinition) return false;

	return (targetItemDefinition.mergeIds ?? [])
		.map((mergeId) => config.merge[mergeId])
		.some((rule) => rule?.withItemId === sourceItemId && rule.consumeSource === false);
};

export const resolveDropIntent = ({
	config,
	sourceItemId,
	targetItem,
}: resolveDropIntent.Props): DropIntent => {
	const mergeRule = resolveRuntimeMergeRule({
		config,
		sourceItemId,
		targetItemId: targetItem.itemId,
	});
	const reverseDirectedMerge = hasReverseDirectedMergeRule({
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
		targetItem.activation?.inputs.some(
			(input) => input.itemId === sourceItemId && input.stored < input.capacity,
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
			resultItemId: mergeRule?.resultItemId as ItemId | undefined,
			directed: mergeRule?.consumeSource === false,
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
