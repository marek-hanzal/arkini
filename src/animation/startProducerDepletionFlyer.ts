import { boardSourceId } from "~/board/boardSourceId";
import type { BoardViewItem, ProducerDropResult } from "~/play/logic/playTypes";
import type { FlyerKind, VisualMeta, RectLike } from "~/play/types";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";

export namespace startProducerDepletionFlyer {
	export interface Props {
		boardItem: BoardViewItem;
		result: ProducerDropResult;
		hideSources(ids: readonly string[]): void;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
	}
}

export const startProducerDepletionFlyer = ({
	boardItem,
	result,
	hideSources,
	addFlyer,
}: startProducerDepletionFlyer.Props) => {
	if (result.depletion?.kind !== "remove") return null;

	const sourceId = boardSourceId(boardItem.id);
	const sourceRect =
		queryPaddingBoxRect(`[data-board-item-tile-id="${boardItem.id}"]`) ??
		queryPaddingBoxRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`);
	if (!sourceRect) return null;

	hideSources([
		sourceId,
	]);
	return addFlyer(boardItem.itemId, sourceRect, sourceRect, "deplete", {
		activation: boardItem.activation ?? undefined,
	});
};
