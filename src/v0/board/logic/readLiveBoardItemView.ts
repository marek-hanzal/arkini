import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";

export namespace readLiveBoardItemView {
	export interface Props {
		boardItem?: BoardViewItem | null;
		nowMs: number;
	}
}

export const readLiveBoardItemView = ({
	boardItem,
	nowMs,
}: readLiveBoardItemView.Props): BoardViewItem | undefined => {
	if (!boardItem) return undefined;

	const productLines = boardItem.activation?.productLines?.map((line) =>
		readLiveProducerProductLineView({
			line,
			nowMs,
		}),
	);

	return {
		...boardItem,
		activation: boardItem.activation
			? {
					...boardItem.activation,
					productLines,
				}
			: undefined,
		craft: readLiveCraftView({
			craft: boardItem.craft,
			nowMs,
		}),
	};
};
