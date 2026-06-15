export type InventorySpendPlan =
	| {
			type: "delete";
			stackId: string;
	  }
	| {
			type: "update";
			stackId: string;
			quantity: number;
	  };
