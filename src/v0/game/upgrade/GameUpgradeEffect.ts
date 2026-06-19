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
			type: "product.inputRef.set";
			productId: string;
			inputRefId: string;
	  }
	| {
			type: "product.input.quantity.add";
			productId: string;
			itemId: string;
			quantity: number;
	  }
	| {
			type: "product.requirementIds.set";
			productId: string;
			requirementIds: readonly string[];
	  }
	| {
			type: "producer.maxQueueSize.add";
			producerId: string;
			quantity: number;
	  }
	| {
			type: "producer.requirementIds.set";
			producerId: string;
			requirementIds: readonly string[];
	  };
