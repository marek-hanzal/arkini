type ItemInteractionFeedbackVariant = "primary" | "secondary";

export type ItemToBoardItemInteractionPlan =
	| {
			type: "reject";
	  }
	| {
			type: "swap";
	  }
	| {
			resultItemId?: string;
			type: "merge";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "craft-input";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			lineId: string;
			type: "producer-input";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "stash-input";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "tile-remove";
	  };
