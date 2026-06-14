import { fromPromise, setup } from "xstate";

interface ResetWorkflowContext {
	reset(): Promise<void>;
	onSuccess(): void;
	onError(error: unknown): void;
}

type ResetWorkflowEvent =
	| {
			type: "START";
	  }
	| {
			type: "RESET";
	  };

export const resetWorkflowMachine = setup({
	types: {
		context: {} as ResetWorkflowContext,
		events: {} as ResetWorkflowEvent,
		input: {} as ResetWorkflowContext,
	},
	actors: {
		runReset: fromPromise(({ input }: { input: ResetWorkflowContext }) => input.reset()),
	},
	actions: {
		notifySuccess: ({ context }) => context.onSuccess(),
		notifyError: ({ context, event }) => {
			context.onError(
				(
					event as unknown as {
						error: unknown;
					}
				).error,
			);
		},
	},
}).createMachine({
	id: "resetWorkflow",
	initial: "idle",
	context: ({ input }) => input,
	states: {
		idle: {
			on: {
				START: "pending",
			},
		},
		pending: {
			invoke: {
				src: "runReset",
				input: ({ context }) => context,
				onDone: {
					target: "succeeded",
					actions: "notifySuccess",
				},
				onError: {
					target: "failed",
					actions: "notifyError",
				},
			},
			on: {
				RESET: "idle",
			},
		},
		succeeded: {},
		failed: {
			on: {
				START: "pending",
				RESET: "idle",
			},
		},
	},
});
