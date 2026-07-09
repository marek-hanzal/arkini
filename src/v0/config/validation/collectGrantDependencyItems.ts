import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type { AddBlueprintDependencyItem } from "~/config/validation/BlueprintDependencyTypes";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import { readDomainSelectorIds } from "~/config/validation/GameConfigSelectorValidation";
import { readPassiveGrantSourceItemIdsByGrantId } from "~/config/validation/readBlueprintDependencyItems";

export const collectGrantDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	selector,
	path,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	config: GameConfig;
	fromBlueprintItemId: string;
	selector: z.infer<typeof ResolvedDomainSelectorSchema> | undefined;
	path: GameConfigIssuePath;
}) => {
	if (!selector) return;

	const grantSourceItemIdsByGrantId = readPassiveGrantSourceItemIdsByGrantId(config);
	for (const grantId of readDomainSelectorIds(selector)) {
		for (const itemId of grantSourceItemIdsByGrantId.get(grantId) ?? []) {
			addDependencyItem({
				fromBlueprintItemId,
				itemId,
				path,
			});
		}
	}
};
