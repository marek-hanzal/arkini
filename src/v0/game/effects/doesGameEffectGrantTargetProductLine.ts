import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";

type GrantEffectOperation = Extract<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "grant.add";
	}
>;

export namespace doesGameEffectGrantTargetProductLine {
	export interface Props {
		producerId: string;
		productId: string;
		target: GrantEffectOperation["target"];
	}
}

export const doesGameEffectGrantTargetProductLine = ({
	producerId,
	productId,
	target,
}: doesGameEffectGrantTargetProductLine.Props) => {
	if (!target.producers && !target.productLines) return false;

	return (
		doesResolvedDomainSelectorMatchId({
			entityId: producerId,
			selector: target.producers,
		}) &&
		doesResolvedDomainSelectorMatchId({
			entityId: productId,
			selector: target.productLines,
		})
	);
};
