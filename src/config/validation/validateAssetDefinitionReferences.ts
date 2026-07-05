import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import type { ConfigDefinitionReferenceContext } from "~/config/validation/ConfigDefinitionReferenceTypes";

export const validateAssetDefinitionReferences = ({
	ctx,
	hasResource,
	value,
}: Pick<ConfigDefinitionReferenceContext, "ctx" | "hasResource" | "value">) => {
	const hasAsset = (assetId: string) => Boolean(value.assets[assetId]);

	for (const [assetId, asset] of Object.entries(value.assets)) {
		if (!hasResource(asset.resourceId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"resourceId",
				],
				`Missing resource "${asset.resourceId}".`,
			);
		}
		if (asset.overlayAssetId && !hasAsset(asset.overlayAssetId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"overlayAssetId",
				],
				`Missing overlay asset "${asset.overlayAssetId}".`,
			);
		}
	}
};
