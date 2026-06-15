import { setup } from "xstate";

export namespace draggableWorkflowMachine {
	export type Event =
		| {
				type: "DRAG_STARTED";
		  }
		| {
				type: "DRAG_CANCELLED";
		  }
		| {
				type: "DROP_RESOLVING";
		  }
		| {
				type: "DROP_IGNORED";
		  }
		| {
				type: "DROP_ACCEPTED";
		  }
		| {
				type: "DROP_REJECTED";
		  }
		| {
				type: "DROP_FAILED";
		  }
		| {
				type: "COMMIT_STARTED";
		  }
		| {
				type: "ANIMATION_STARTED";
		  }
		| {
				type: "RETURN_STARTED";
		  }
		| {
				type: "FEEDBACK_STARTED";
		  }
		| {
				type: "SETTLING_STARTED";
		  }
		| {
				type: "DROP_SETTLED";
		  }
		| {
				type: "RESET";
		  };
}

/**
 * UI-only drag workflow statechart. Domain data stays outside; this actor only
 * documents and gates the transient pointer drag/drop lifecycle.
 */
export const draggableWorkflowMachine = setup({
	types: {
		events: {} as draggableWorkflowMachine.Event,
	},
}).createMachine({
	id: "draggableWorkflow",
	initial: "idle",
	states: {
		idle: {
			on: {
				DRAG_STARTED: "dragging",
				RESET: "idle",
			},
		},
		dragging: {
			on: {
				DRAG_CANCELLED: "idle",
				DROP_RESOLVING: "resolving",
				RESET: "idle",
			},
		},
		resolving: {
			on: {
				DROP_IGNORED: "settling",
				DROP_ACCEPTED: "accepting",
				DROP_REJECTED: "rejecting",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		accepting: {
			on: {
				ANIMATION_STARTED: "animating",
				COMMIT_STARTED: "committing",
				SETTLING_STARTED: "settling",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		rejecting: {
			on: {
				RETURN_STARTED: "returning",
				FEEDBACK_STARTED: "feedback",
				SETTLING_STARTED: "settling",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		committing: {
			on: {
				ANIMATION_STARTED: "animating",
				SETTLING_STARTED: "settling",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		animating: {
			on: {
				COMMIT_STARTED: "committing",
				SETTLING_STARTED: "settling",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		returning: {
			on: {
				FEEDBACK_STARTED: "feedback",
				SETTLING_STARTED: "settling",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		feedback: {
			on: {
				SETTLING_STARTED: "settling",
				DROP_FAILED: "failing",
				RESET: "idle",
			},
		},
		failing: {
			on: {
				RETURN_STARTED: "returning",
				FEEDBACK_STARTED: "feedback",
				SETTLING_STARTED: "settling",
				RESET: "idle",
			},
		},
		settling: {
			on: {
				DROP_SETTLED: "idle",
				RESET: "idle",
			},
		},
	},
});
