import { fromPromise, setup } from "xstate";

export namespace resetWorkflowMachine {
	export interface Context {
		reset(): Promise<void>;
		onSuccess(): void;
		onError(error: unknown): void;
	}

	export type Event =
		| {
				type: "START";
		  }
		| {
				type: "RESET";
		  };
}

export const resetWorkflowMachine = setup({
	types: {
		context: {} as resetWorkflowMachine.Context,
		events: {} as resetWorkflowMachine.Event,
		input: {} as resetWorkflowMachine.Context,
	},
	actors: {
		runReset: fromPromise(({ input }: { input: resetWorkflowMachine.Context }) =>
			input.reset(),
		),
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
