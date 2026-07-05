import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import type {
	ConfigDefinitionReferenceContext,
	ConfigItem,
} from "~/config/validation/ConfigDefinitionReferenceTypes";

export const validateItemAssetReferences = ({
	ctx,
	item,
	itemId,
	value,
}: {
	ctx: ConfigDefinitionReferenceContext["ctx"];
	item: ConfigItem;
	itemId: string;
	value: ConfigDefinitionReferenceContext["value"];
}) => {
	for (const [assetIndex, assetId] of item.assetIds.entries()) {
		if (value.assets[assetId]) continue;
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"assetIds",
				assetIndex,
			],
			`Missing asset "${assetId}".`,
		);
	}
};
