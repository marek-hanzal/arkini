export type GameUpgradeEffect =
	| {
			type: "product.duration.add";
			productId: string;
			ms: number;
	  }
	| {
			type: "product.outputTable.set";
			productId: string;
			tableId: string;
	  }
	| {
			type: "product.input.quantity.add";
			productId: string;
			itemId: string;
			quantity: number;
	  }
	| {
			type: "producer.maxQueueSize.add";
			producerId: string;
			quantity: number;
	  };
