import type { GameConfigValidationContext } from "~/config/validation/GameConfigValidationCommon";
import { validateAssetDefinitionReferences } from "~/config/validation/validateAssetDefinitionReferences";
import { validateItemDefinitionReferences } from "~/config/validation/validateItemDefinitionReferences";

export const validateConfigDefinitionReferences = ({
	config: value,
	ctx,
	grantIds,
	hasItem,
	hasResource,
	itemIds,
}: GameConfigValidationContext) => {
	validateAssetDefinitionReferences({
		ctx,
		hasResource,
		value,
	});
	validateItemDefinitionReferences({
		ctx,
		grantIds,
		hasItem,
		itemIds,
		value,
	});
};
