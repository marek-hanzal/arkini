export type Sheet = "inventory" | "upgrades" | "database" | "item";

export interface ActiveSheetState {
	type: Sheet;
	boardItemId?: string;
}
