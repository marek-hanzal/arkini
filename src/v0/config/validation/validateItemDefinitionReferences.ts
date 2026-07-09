import type { ConfigDefinitionReferenceContext } from "~/config/validation/ConfigDefinitionReferenceTypes";
import { validateItemAssetReferences } from "~/config/validation/validateItemAssetReferences";
import { validateItemCapabilityReferences } from "~/config/validation/validateItemCapabilityReferences";
import { validateItemMergeReferences } from "~/config/validation/validateItemMergeReferences";
import { validateItemOwnDefinition } from "~/config/validation/validateItemOwnDefinition";
import { validateItemRemovalReferences } from "~/config/validation/validateItemRemovalReferences";

export const validateItemDefinitionReferences = ({
	ctx,
	grantIds,
	hasItem,
	itemIds,
	value,
}: Pick<
	ConfigDefinitionReferenceContext,
	"ctx" | "grantIds" | "hasItem" | "itemIds" | "value"
>) => {
	for (const [itemId, item] of Object.entries(value.items)) {
		validateItemAssetReferences({
			ctx,
			item,
			itemId,
			value,
		});
		validateItemOwnDefinition({
			ctx,
			hasItem,
			item,
			itemId,
		});
		validateItemMergeReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
		});
		validateItemRemovalReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
		});
		validateItemCapabilityReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
			value,
		});
	}
};
