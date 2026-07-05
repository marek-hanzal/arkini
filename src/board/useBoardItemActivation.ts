import { useCallback } from "react";
import { handleResolvedBoardItemTapAction } from "~/board/handleResolvedBoardItemTapAction";
import { readBoardItemActivationContext } from "~/board/readBoardItemActivationContext";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export namespace useBoardItemActivation {
	export interface Props {
		feedback: Feedback.Type;
		onOpenSheet(sheet: ActiveSheetState): void;
	}

	export type Result = (boardItemId: string, expectedItemId: string) => void;
}

export const useBoardItemActivation = ({
	feedback,
	onOpenSheet,
}: useBoardItemActivation.Props): useBoardItemActivation.Result => {
	const runtimeStore = useGameRuntimeStore();

	return useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const context = readBoardItemActivationContext({
				boardItemId,
				expectedItemId,
				feedback,
				onOpenSheet,
				runtimeStore,
			});
			if (!context) return;
			handleResolvedBoardItemTapAction({
				context,
			});
		},
		[
			feedback,
			onOpenSheet,
			runtimeStore,
		],
	);
};
