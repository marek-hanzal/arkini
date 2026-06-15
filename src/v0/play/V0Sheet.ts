export type V0Sheet = "inventory" | "upgrades" | "database" | "item";

export interface V0ActiveSheetState {
	type: V0Sheet;
	boardItemId?: string;
}
