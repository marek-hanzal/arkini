import { useMemo } from "react";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace usePlaySheetHostController {
	export interface Props {}
}

export const usePlaySheetHostController = (_props?: usePlaySheetHostController.Props) => {
	const sheets = usePlaySheetsState();

	return useMemo(
		() => ({
			open: sheets.activeSheet !== undefined,
			onClose: sheets.closeSheet,
		}),
		[
			sheets.activeSheet,
			sheets.closeSheet,
		],
	);
};
