import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type ProductLineEffectOperation = Exclude<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "item.blockCreate";
	}
>;

type ResolvedDomainSelector = NonNullable<ProductLineEffectOperation["target"]["producers"]>;

export namespace doesResolvedDomainSelectorMatchId {
	export interface Props {
		entityId: string;
		selector: ResolvedDomainSelector | undefined;
	}
}

export const doesResolvedDomainSelectorMatchId = ({
	entityId,
	selector,
}: doesResolvedDomainSelectorMatchId.Props) => {
	if (!selector || "mode" in selector) return true;
	if (selector.anyOf && !selector.anyOf.some((clause) => clause.ids.includes(entityId))) {
		return false;
	}
	if (selector.allOf && !selector.allOf.every((clause) => clause.ids.includes(entityId))) {
		return false;
	}
	if (selector.noneOf?.some((clause) => clause.ids.includes(entityId))) {
		return false;
	}
	return true;
};
