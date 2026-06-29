import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";

type ProductLineEffectOperation = Exclude<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "item.blockCreate";
	}
>;

export namespace doesGameEffectTargetProductLine {
	export interface Props {
		producerId: string;
		productId: string;
		target: ProductLineEffectOperation["target"];
	}
}

export const doesGameEffectTargetProductLine = ({
	producerId,
	productId,
	target,
}: doesGameEffectTargetProductLine.Props) =>
	doesResolvedDomainSelectorMatchId({
		entityId: producerId,
		selector: target.producers,
	}) &&
	doesResolvedDomainSelectorMatchId({
		entityId: productId,
		selector: target.productLines,
	});
