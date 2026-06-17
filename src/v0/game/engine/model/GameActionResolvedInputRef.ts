export type GameActionResolvedInputRef =
	| {
			kind: "board";
			itemId: string;
			itemInstanceId: string;
			quantity: 1;
	  }
	| {
			kind: "inventory";
			itemId: string;
			slotIndex: number;
			quantity: number;
	  };
