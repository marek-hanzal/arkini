type ItemInteractionFeedbackVariant = "primary" | "secondary";

export type ItemToBoardItemInteractionPlan =
	| {
			type: "reject";
	  }
	| {
			type: "swap";
	  }
	| {
			type: "stack";
	  }
	| {
			resultItemId?: string;
			type: "merge";
	  }
	| {
			consumedQuantity: number;
			consumesSource: true;
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "craft-input";
	  }
	| {
			consumedQuantity: number;
			consumesSource: true;
			feedbackVariant: ItemInteractionFeedbackVariant;
			lineId: string;
			type: "producer-input";
	  }
	| {
			consumedQuantity: number;
			consumesSource: true;
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "stash-input";
	  }
	| {
			consumedQuantity: number;
			consumesSource: boolean;
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "tile-remove";
	  };
