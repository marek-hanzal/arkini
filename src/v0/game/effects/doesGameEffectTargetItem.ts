import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";

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

export const doesGameEffectTargetItem = ({ itemId, target }: doesGameEffectTargetItem.Props) =>
	doesResolvedDomainSelectorMatchId({
		entityId: itemId,
		selector: target.items,
	});
