import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";

type GrantEffectOperation = Extract<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "grant.add";
	}
>;

export namespace doesGameEffectGrantTargetItem {
	export interface Props {
		itemId: string;
		target: GrantEffectOperation["target"];
	}
}

export const doesGameEffectGrantTargetItem = ({
	itemId,
	target,
}: doesGameEffectGrantTargetItem.Props) => {
	if (!target.items) return false;

	return doesResolvedDomainSelectorMatchId({
		entityId: itemId,
		selector: target.items,
	});
};
