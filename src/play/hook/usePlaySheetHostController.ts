import { useMemo } from "react";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace usePlaySheetHostController {
	export interface Props {}
}

/**
 * GPT:FIX
 *
 * Nice and long name. Make it short.
 *
 * Also ensure sheets are stable, so useMemo makes sense.
 */
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
