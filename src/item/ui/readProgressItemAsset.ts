import type { ViewItem, ViewItemAsset } from "~/item/view/ViewItemSchema";

const clampProgress = (progress: number) => Math.min(1, Math.max(0, progress));

export const readProgressItemAsset = ({
	item,
	progress = 0,
}: {
	item: ViewItem;
	progress?: number;
}): ViewItemAsset => {
	const assetCount = item.assets.length;
	const index = Math.min(assetCount - 1, Math.floor(clampProgress(progress) * assetCount));

	return item.assets[index] ?? item.assets[0];
};
