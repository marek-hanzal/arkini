export type ItemInteractionFeedbackVariant = "primary" | "secondary";

export type ItemToBoardItemInteractionPlan =
	| {
			type: "reject";
	  }
	| {
			type: "swap";
	  }
	| {
			directed: boolean;
			resultItemId?: string;
			type: "merge";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "stored-requirement";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "craft-input";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			productId: string;
			type: "producer-input";
	  }
	| {
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "stash-input";
	  };
