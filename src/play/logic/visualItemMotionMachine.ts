import { assign, setup } from "xstate";
import type { RectLike, VisualTransitionKind } from "~/play/types";

export type VisualItemMotionPriority = "normal" | "raised";

export interface VisualItemMotion {
	from: RectLike;
	to: RectLike;
	priority: VisualItemMotionPriority;
	nonce: number;
	kind?: VisualTransitionKind;
}

export namespace visualItemMotionMachine {
	export type Event =
		| {
				type: "STAGE";
				entries: readonly {
					key: string;
					from: RectLike;
					to: RectLike;
					priority?: VisualItemMotionPriority;
					kind?: VisualTransitionKind;
				}[];
		  }
		| {
				type: "SETTLED";
				key: string;
				nonce: number;
		  }
		| {
				type: "CLEAR";
		  };

	export interface Context {
		motions: Record<string, VisualItemMotion>;
		nextNonce: number;
	}
}

/**
 * UI-only motion registry for real item actors.
 *
 * The engine commits durable board/inventory data; this machine only keeps the
 * transient visual origin/priority needed by newly created or moved actors until
 * their Motion transition settles. Keeping this as a statechart avoids another
 * handmade side-state swamp next to the drag/drop workflow.
 */
export const visualItemMotionMachine = setup({
	types: {
		context: {} as visualItemMotionMachine.Context,
		events: {} as visualItemMotionMachine.Event,
	},
}).createMachine({
	id: "visualItemMotion",
	initial: "ready",
	context: {
		motions: {},
		nextNonce: 1,
	},
	states: {
		ready: {
			on: {
				STAGE: {
					actions: assign(({ context, event }) => {
						const motions = {
							...context.motions,
						};
						let nextNonce = context.nextNonce;

						for (const entry of event.entries) {
							motions[entry.key] = {
								from: entry.from,
								to: entry.to,
								priority: entry.priority ?? "raised",
								nonce: nextNonce,
								kind: entry.kind,
							};
							nextNonce += 1;
						}

						return {
							motions,
							nextNonce,
						};
					}),
				},
				SETTLED: {
					actions: assign(({ context, event }) => {
						const current = context.motions[event.key];
						if (!current || current.nonce !== event.nonce) return context;

						const { [event.key]: _settled, ...motions } = context.motions;

						return {
							...context,
							motions,
						};
					}),
				},
				CLEAR: {
					actions: assign(({ context }) => ({
						...context,
						motions: {},
					})),
				},
			},
		},
	},
});
