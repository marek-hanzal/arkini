import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { readLiveProducerLineView } from "~/v0/producer/logic/readLiveProducerLineView";

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

	const producerLines = boardItem.activation?.producerLines?.map((line) =>
		readLiveProducerLineView({
			line,
			nowMs,
		}),
	);

	return {
		...boardItem,
		activation: boardItem.activation
			? {
					...boardItem.activation,
					producerLines,
				}
			: undefined,
		craft: readLiveCraftView({
			craft: boardItem.craft,
			nowMs,
		}),
	};
};
