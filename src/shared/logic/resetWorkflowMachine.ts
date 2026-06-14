import { setup } from "xstate";

type ResetWorkflowEvent =
	| {
			type: "START";
	  }
	| {
			type: "FAIL";
	  }
	| {
			type: "RESET";
	  };

export const resetWorkflowMachine = setup({
	types: {
		events: {} as ResetWorkflowEvent,
	},
}).createMachine({
	id: "resetWorkflow",
	initial: "idle",
	states: {
		idle: {
			on: {
				START: "pending",
			},
		},
		pending: {
			on: {
				FAIL: "failed",
				RESET: "idle",
			},
		},
		failed: {
			on: {
				START: "pending",
				RESET: "idle",
			},
		},
	},
});
