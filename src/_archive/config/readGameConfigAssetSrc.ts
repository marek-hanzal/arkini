import type { GameConfig } from "~/config/GameConfigTypes";

export const readGameResourceSrc = (data: string | undefined) => {
	if (!data) return undefined;
	if (/^[a-z][a-z0-9+.-]*:/i.test(data)) return data;
	return `data:image/png;base64,${data}`;
};

export const readGameConfigAssetSrc = ({
	assetId,
	config,
}: {
	assetId: string;
	config: GameConfig;
}) => {
	const asset = config.assets[assetId];
	if (!asset) return undefined;
	return readGameResourceSrc(config.resources[asset.resourceId]?.data);
};
