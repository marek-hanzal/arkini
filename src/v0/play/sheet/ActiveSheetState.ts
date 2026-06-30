export type ActiveSheetState =
	| {
			type: "inventory";
			placementTarget?: {
				x: number;
				y: number;
			};
	  }
	| {
			type: "cheat-inventory";
	  }
	| {
			type: "nuke-save";
	  }
	| {
			type: "item";
			boardItemId: string;
	  };
