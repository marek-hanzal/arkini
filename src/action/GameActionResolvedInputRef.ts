export type GameActionResolvedInputRef =
	| {
			kind: "board";
			itemId: string;
			itemInstanceId: string;
			quantity: number;
	  }
	| {
			kind: "inventory";
			itemId: string;
			slotIndex: number;
			quantity: number;
	  };
