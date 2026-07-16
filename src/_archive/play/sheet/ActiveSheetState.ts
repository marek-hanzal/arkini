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
			type: "board-memory";
			boardItemId: string;
	  }
	| {
			type: "item";
			boardItemId: string;
	  };
