import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type ItemEffectOperation = Extract<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "item.blockCreate";
	}
>;

export namespace doesGameEffectTargetItem {
	export interface Props {
		itemId: string;
		target: ItemEffectOperation["target"];
	}
}

export const doesGameEffectTargetItem = ({ itemId, target }: doesGameEffectTargetItem.Props) => {
	const selector = target.items;
	if (selector.all) return true;
	return selector.ids?.includes(itemId) ?? false;
};
