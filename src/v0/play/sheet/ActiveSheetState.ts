import type { Sheet } from "~/v0/play/sheet/Sheet";

export interface ActiveSheetState {
	type: Sheet;
	boardItemId?: string;
}
