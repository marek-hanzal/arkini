import { useMemo } from "react";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";

export const useBlockedBoardCellKeys = ({
	board,
}: {
	board: ReturnType<typeof useGameBoardView>;
}) =>
	useMemo(
		() =>
			Object.entries(board.byCellKey)
				.filter(
					([, boardItem]) =>
						boardItem.activation?.deliveryBlocked || boardItem.craft?.deliveryBlocked,
				)
				.map(([key]) => key),
		[
			board.byCellKey,
		],
	);
