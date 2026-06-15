import { useMachine } from "@xstate/react";
import { useCallback } from "react";
import { playSheetMachine } from "~/play/logic/playSheetMachine";
import type { ActiveSheet, BottomNavSheet } from "~/play/logic/playSheetTypes";

/**
 * GPT:FIX
 *
 * This is a question: I know we're using machine for managing sheet state, but it's really a clean way how to
 * manage sheets having this piece of crappy effect?
 *
 * Looks like we may implement this in absolutely different way, e.g. by using local state on buttons opening sheets,
 * keep them controlled by sheets itself (e.g. passing down "close" method to the sheet so it can close itself).
 *
 * This shit should be removed.
 */
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
