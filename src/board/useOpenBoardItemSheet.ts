import { useCallback } from "react";
import { readBoardItemSheet } from "~/board/readBoardItemSheet";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export const useOpenBoardItemSheet = ({
	onOpenSheet,
	runtimeStore,
}: {
	onOpenSheet(sheet: ActiveSheetState): void;
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) =>
	useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const snapshot = runtimeStore.getSnapshot();
			const liveBoardItem = readExpectedBoardViewItem({
				board: readBoardView(snapshot, Date.now()),
				expectedItemId,
				itemInstanceId: boardItemId,
			});
			if (!liveBoardItem) return;

			onOpenSheet(
				readBoardItemSheet({
					boardItemId: liveBoardItem.id,
					itemId: liveBoardItem.itemId,
				}),
			);
		},
		[
			onOpenSheet,
			runtimeStore,
		],
	);
