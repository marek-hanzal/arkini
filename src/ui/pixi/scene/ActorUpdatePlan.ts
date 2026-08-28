export interface ActorUpdatePlan {
	readonly activityEffect: "start" | "stop" | null;
	readonly crowdAlpha: number | null;
	readonly item:
		| {
				readonly kind: "assign";
		  }
		| {
				readonly kind: "progress";
		  }
		| {
				readonly kind: "visual";
				readonly preserveVisual: boolean;
				readonly size: number;
		  };
	readonly pose:
		| {
				readonly kind: "owned";
		  }
		| {
				readonly kind: "place";
		  }
		| {
				readonly directLanding: boolean;
				readonly kind: "travel";
				readonly scaleBeforeTravel: number | null;
		  };
}
