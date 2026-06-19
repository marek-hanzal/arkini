import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";

type MergeDefinition = GameConfig["merge"][string];

export interface ExecutableItemMergeRule {
	merge: MergeDefinition;
	/** Item definition that authored the merge rule. */
	ruleOwnerItemId: ItemId | string;
	/** Directed/imprint merges are intentionally one-way. */
	directed: boolean;
}

export namespace resolveExecutableItemMergeRule {
	export interface Props {
		config: GameConfig;
		sourceItemId: ItemId | string;
		targetItemId: ItemId | string;
	}
}

const readOwnedMergeRule = ({
	config,
	ownerItemId,
	withItemId,
}: {
	config: GameConfig;
	ownerItemId: ItemId | string;
	withItemId: ItemId | string;
}) => {
	const owner = config.items[ownerItemId];
	if (!owner) return undefined;

	return (owner.mergeIds ?? [])
		.map((mergeId) => config.merge[mergeId])
		.find((rule) => rule?.withItemId === withItemId);
};

export const resolveExecutableItemMergeRule = ({
	config,
	sourceItemId,
	targetItemId,
}: resolveExecutableItemMergeRule.Props): ExecutableItemMergeRule | undefined => {
	const sourceOwnedRule = readOwnedMergeRule({
		config,
		ownerItemId: sourceItemId,
		withItemId: targetItemId,
	});
	if (!sourceOwnedRule) return undefined;

	return {
		directed: sourceOwnedRule.consumeSource === false,
		merge: sourceOwnedRule,
		ruleOwnerItemId: sourceItemId,
	};
};

/**
 * Reverse-directed imprint rules are not executable merges, but they still block the
 * generic occupied-tile swap fallback. A building -> blueprint rule means dragging a
 * blueprint onto that building should be rejected, not silently treated as a swap.
 */
export const hasReverseDirectedItemMergeRule = ({
	config,
	sourceItemId,
	targetItemId,
}: resolveExecutableItemMergeRule.Props): boolean => {
	const targetOwnedRule = readOwnedMergeRule({
		config,
		ownerItemId: targetItemId,
		withItemId: sourceItemId,
	});

	return targetOwnedRule?.consumeSource === false;
};
