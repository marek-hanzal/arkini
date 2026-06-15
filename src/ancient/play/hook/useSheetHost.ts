import { useMemo } from "react";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace useSheetHost {
	export interface Props {}
}

export const useSheetHost = (_props?: useSheetHost.Props) => {
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
