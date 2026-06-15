import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";

export namespace actorVisualRect {
	export interface Props {
		itemInstanceId?: string;
	}
}

export const actorVisualRect = ({ itemInstanceId }: actorVisualRect.Props) => {
	if (!itemInstanceId) return null;

	return (
		queryPaddingBoxRect(`[data-board-item-tile-id="${itemInstanceId}"]`) ??
		queryPaddingBoxRect(`[data-board-item-id="${itemInstanceId}"]`) ??
		queryPaddingBoxRect(`[data-inventory-stack-id="${itemInstanceId}"]`)
	);
};
