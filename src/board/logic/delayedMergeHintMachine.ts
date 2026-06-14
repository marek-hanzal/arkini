import { assign, setup } from "xstate";

interface DelayedMergeHintContext {
	delayMs: number;
}

type DelayedMergeHintEvent =
	| {
			type: "START";
			delayMs: number;
	  }
	| {
			type: "STOP";
	  };

export const delayedMergeHintMachine = setup({
	types: {
		context: {} as DelayedMergeHintContext,
		events: {} as DelayedMergeHintEvent,
	},
	delays: {
		revealDelay: ({ context }) => context.delayMs,
	},
	actions: {
		setDelay: assign(({ event }) => {
			if (event.type !== "START") return {};
			return {
				delayMs: event.delayMs,
			};
		}),
	},
}).createMachine({
	id: "delayedMergeHint",
	initial: "hidden",
	context: {
		delayMs: 750,
	},
	states: {
		hidden: {
			on: {
				START: {
					target: "waiting",
					actions: "setDelay",
				},
			},
		},
		waiting: {
			after: {
				revealDelay: "visible",
			},
			on: {
				START: {
					target: "waiting",
					reenter: true,
					actions: "setDelay",
				},
				STOP: "hidden",
			},
		},
		visible: {
			on: {
				START: {
					target: "waiting",
					reenter: true,
					actions: "setDelay",
				},
				STOP: "hidden",
			},
		},
	},
});
