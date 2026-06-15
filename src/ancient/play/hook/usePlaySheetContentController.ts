import { useMemo } from "react";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace usePlaySheetContentController {
	export interface Props {}
}

export const usePlaySheetContentController = (_props?: usePlaySheetContentController.Props) => {
	const sheets = usePlaySheetsState();

	return useMemo(
		() => ({
			renderedSheet: sheets.renderedSheet,
			selectedBoardItemId: sheets.selectedBoardItemId,
			closeSheet: sheets.closeSheet,
		}),
		[
			sheets.closeSheet,
			sheets.renderedSheet,
			sheets.selectedBoardItemId,
		],
	);
};
