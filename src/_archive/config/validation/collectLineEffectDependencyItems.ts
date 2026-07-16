import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import type { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type { AddBlueprintDependencyItem } from "~/config/validation/BlueprintDependencyTypes";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import { readDomainSelectorIds } from "~/config/validation/GameConfigSelectorValidation";
import { collectGrantDependencyItems } from "~/config/validation/collectGrantDependencyItems";

type GameConfigRuntimeEffect =
	| z.infer<typeof GameLineEffectSchema>
	| z.infer<typeof GameDropEffectSchema>;

export const collectLineEffectDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	lineEffects,
	path,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	config: GameConfig;
	fromBlueprintItemId: string;
	lineEffects: readonly GameConfigRuntimeEffect[];
	path: GameConfigIssuePath;
}) => {
	for (const [lineEffectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			collectGrantDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				selector: lineEffect.selector,
				path: [
					...path,
					lineEffectIndex,
					"selector",
				],
			});
		}

		if (lineEffect.kind === "nearby.require") {
			for (const itemId of readDomainSelectorIds(
				lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			)) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId,
					path: [
						...path,
						lineEffectIndex,
						"items",
					],
				});
			}
		}
	}
};
