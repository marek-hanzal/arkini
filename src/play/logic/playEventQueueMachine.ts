import { assign, fromPromise, setup } from "xstate";
import { activeQueuedEvent } from "./activeQueuedEvent";

export namespace playEventQueueMachine {
	export interface QueuedEvent<T = unknown> {
		label: string;
		run(): Promise<T> | T;
		resolve(value: T): void;
		reject(error: unknown): void;
	}

	export interface Context {
		active?: QueuedEvent;
		queue: QueuedEvent[];
	}

	export type Event = {
		type: "ENQUEUE";
		event: QueuedEvent;
	};
}

export const playEventQueueMachine = setup({
	types: {
		context: {} as playEventQueueMachine.Context,
		events: {} as playEventQueueMachine.Event,
	},
	actors: {
		runEvent: fromPromise(async ({ input }: { input: playEventQueueMachine.QueuedEvent }) =>
			input.run(),
		),
	},
	actions: {
		startEvent: assign(({ event }) => ({
			active: event.event,
		})),
		enqueueEvent: assign(({ context, event }) => ({
			queue: [
				...context.queue,
				event.event,
			],
		})),
		resolveActive: ({ context, event }) => {
			context.active?.resolve(
				(
					event as unknown as {
						output: unknown;
					}
				).output,
			);
		},
		rejectActive: ({ context, event }) => {
			context.active?.reject(
				(
					event as unknown as {
						error: unknown;
					}
				).error,
			);
		},
		startQueuedEvent: assign(({ context }) => {
			const [active, ...queue] = context.queue;

			return {
				active,
				queue,
			};
		}),
		clearActive: assign({
			active: undefined,
		}),
	},
	guards: {
		hasQueuedEvent: ({ context }) => context.queue.length > 0,
	},
}).createMachine({
	id: "playEventQueue",
	initial: "idle",
	context: {
		queue: [],
	},
	states: {
		idle: {
			on: {
				ENQUEUE: {
					target: "running",
					actions: "startEvent",
				},
			},
		},
		running: {
			invoke: {
				id: "runCurrentEvent",
				src: "runEvent",
				input: ({ context }) => activeQueuedEvent(context),
				onDone: {
					target: "settling",
					actions: "resolveActive",
				},
				onError: {
					target: "settling",
					actions: "rejectActive",
				},
			},
			on: {
				ENQUEUE: {
					actions: "enqueueEvent",
				},
			},
		},
		settling: {
			always: [
				{
					guard: "hasQueuedEvent",
					target: "running",
					actions: "startQueuedEvent",
				},
				{
					target: "idle",
					actions: "clearActive",
				},
			],
		},
	},
});
