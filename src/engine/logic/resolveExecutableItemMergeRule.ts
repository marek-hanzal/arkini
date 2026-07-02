import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameMergeRuleDefinition } from "~/config/GameItemCapabilities";
import { readItemMergeRules } from "~/config/GameItemCapabilities";
import type { ItemId } from "~/config/GameIdSchema";

export interface ExecutableItemMergeRule {
	merge: GameMergeRuleDefinition;
	/** Item definition that authored the merge rule. */
	ruleOwnerItemId: ItemId | string;
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
}) =>
	readItemMergeRules({
		config,
		itemId: ownerItemId,
	}).find((rule) => rule.withItemId === withItemId);

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
		merge: sourceOwnedRule,
		ruleOwnerItemId: sourceItemId,
	};
};
