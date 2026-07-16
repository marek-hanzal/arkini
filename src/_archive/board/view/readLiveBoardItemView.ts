import { readLiveCraftView } from "~/board/view/readLiveCraftView";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { readLiveLineView } from "~/producer/view/readLiveLineView";

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

	const lines = boardItem.activation?.lines?.map((line) =>
		readLiveLineView({
			line,
			nowMs,
		}),
	);

	return {
		...boardItem,
		activation: boardItem.activation
			? {
					...boardItem.activation,
					lines,
				}
			: undefined,
		craft: readLiveCraftView({
			craft: boardItem.craft,
			nowMs,
		}),
	};
};
