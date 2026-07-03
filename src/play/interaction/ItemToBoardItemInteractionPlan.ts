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
			consumesSource: true;
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "craft-input";
	  }
	| {
			consumesSource: true;
			feedbackVariant: ItemInteractionFeedbackVariant;
			lineId: string;
			type: "producer-input";
	  }
	| {
			consumesSource: true;
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "stash-input";
	  }
	| {
			consumesSource: boolean;
			feedbackVariant: ItemInteractionFeedbackVariant;
			type: "tile-remove";
	  };
