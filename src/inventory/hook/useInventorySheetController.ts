import { useMemo } from "react";
import { useInventoryTileEngine } from "~/inventory/hook/useInventoryTileEngine";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace useInventorySheetController {
	export interface Props {}
}

export const useInventorySheetController = (_props?: useInventorySheetController.Props) => {
	const sheets = usePlaySheetsState();
	const engine = useInventoryTileEngine();

	return useMemo(
		() => ({
			engine,
			onClose: sheets.closeSheet,
		}),
		[
			engine,
			sheets.closeSheet,
		],
	);
};
