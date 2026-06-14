import { useMachine } from "@xstate/react";
import { useCallback } from "react";
import { playSheetMachine } from "~/play/logic/playSheetMachine";
import type { ActiveSheet, BottomNavSheet } from "~/play/logic/playSheetTypes";

export function usePlaySheets() {
	const [sheet, send] = useMachine(playSheetMachine);
	const activeSheet = sheet.matches("open") ? sheet.context.renderedSheet : undefined;
	const selectedBoardItemId =
		activeSheet === "item" ? sheet.context.selectedBoardItemId : undefined;

	const closeSheet = useCallback(
		() =>
			send({
				type: "CLOSE",
			}),
		[
			send,
		],
	);
	const openSheet = useCallback(
		(sheet: BottomNavSheet) =>
			send({
				type: "OPEN_SHEET",
				sheet,
			}),
		[
			send,
		],
	);
	const openItem = useCallback(
		(boardItemId: string) =>
			send({
				type: "OPEN_ITEM",
				boardItemId,
			}),
		[
			send,
		],
	);

	return {
		activeSheet: activeSheet as ActiveSheet | undefined,
		renderedSheet: sheet.context.renderedSheet,
		selectedBoardItemId,
		closeSheet,
		openSheet,
		openItem,
	};
}
