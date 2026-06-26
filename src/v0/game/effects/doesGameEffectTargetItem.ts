import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type ItemEffectOperation = Extract<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "item.blockCreate";
	}
>;

export namespace doesGameEffectTargetItem {
	export interface Props {
		config: GameConfig;
		itemId: string;
		target: ItemEffectOperation["target"];
	}
}

const matchesConfiguredIds = (ids: readonly string[] | undefined, itemId: string) => {
	if (!ids || ids.length === 0) return true;
	return ids.includes(itemId);
};

const matchesAnyConfiguredTag = (
	tags: ReadonlySet<string>,
	configuredTags: readonly string[] | undefined,
) => {
	if (!configuredTags || configuredTags.length === 0) return true;
	for (const tag of configuredTags) {
		if (tags.has(tag)) return true;
	}
	return false;
};

const matchesAllConfiguredTags = (
	tags: ReadonlySet<string>,
	configuredTags: readonly string[] | undefined,
) => {
	if (!configuredTags || configuredTags.length === 0) return true;
	for (const tag of configuredTags) {
		if (!tags.has(tag)) return false;
	}
	return true;
};

export const doesGameEffectTargetItem = ({
	config,
	itemId,
	target,
}: doesGameEffectTargetItem.Props) => {
	if (target.all) return true;

	const item = config.items[itemId];
	if (!item) return false;

	const itemTagSet = new Set(item.tags);

	if (!matchesConfiguredIds(target.itemIds, itemId)) return false;
	if (!matchesAnyConfiguredTag(itemTagSet, target.itemTagsAny)) return false;
	return matchesAllConfiguredTags(itemTagSet, target.itemTagsAll);
};
