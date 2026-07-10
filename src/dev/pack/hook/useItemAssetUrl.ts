import { useDevGamePack } from "./useDevGamePack";
import { readResourceIdFromAssetId } from "~/v1/asset/readResourceIdFromAssetId";
import type { AssetSchema } from "~/v1/item/schema/AssetSchema";

export const useItemAssetUrl = (asset: AssetSchema.Type): string | null => {
	const { resourceUrlById } = useDevGamePack();
	const assetId = asset.source[0];

	return resourceUrlById.get(readResourceIdFromAssetId(assetId)) ?? null;
};
