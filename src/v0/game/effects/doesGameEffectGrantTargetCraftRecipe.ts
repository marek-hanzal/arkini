import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { doesResolvedDomainSelectorMatchId } from "~/v0/game/effects/doesResolvedDomainSelectorMatchId";

type GrantEffectOperation = Extract<
	GameConfig["effects"][string]["operations"][number],
	{
		kind: "grant.add";
	}
>;

export namespace doesGameEffectGrantTargetCraftRecipe {
	export interface Props {
		craftRecipeId: string;
		target: GrantEffectOperation["target"];
	}
}

export const doesGameEffectGrantTargetCraftRecipe = ({
	craftRecipeId,
	target,
}: doesGameEffectGrantTargetCraftRecipe.Props) => {
	if (!target.craftRecipes) return false;

	return doesResolvedDomainSelectorMatchId({
		entityId: craftRecipeId,
		selector: target.craftRecipes,
	});
};
