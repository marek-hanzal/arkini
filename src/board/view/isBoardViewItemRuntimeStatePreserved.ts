import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { requiresBoardViewItemInstancePreservation } from "~/board/view/readBoardViewItemPreservationFacts";

export const isBoardViewItemRuntimeStatePreserved = (boardItem: BoardViewItem) =>
	requiresBoardViewItemInstancePreservation(boardItem);
