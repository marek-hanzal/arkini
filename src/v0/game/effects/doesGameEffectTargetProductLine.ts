import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type ProductLineEffectOperation = Exclude<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "item.blockCreate";
	}
>;

type ResolvedDomainSelector = NonNullable<ProductLineEffectOperation["target"]["producers"]>;

export namespace doesGameEffectTargetProductLine {
	export interface Props {
		producerId: string;
		productId: string;
		target: ProductLineEffectOperation["target"];
	}
}

const matchesResolvedDomainSelector = (
	entityId: string,
	selector: ResolvedDomainSelector | undefined,
) => {
	if (!selector || selector.all) return true;
	return selector.ids?.includes(entityId) ?? false;
};

export const doesGameEffectTargetProductLine = ({
	producerId,
	productId,
	target,
}: doesGameEffectTargetProductLine.Props) =>
	matchesResolvedDomainSelector(producerId, target.producers) &&
	matchesResolvedDomainSelector(productId, target.productLines);
