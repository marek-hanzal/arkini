import { assign, setup } from "xstate";

export interface TileEngineRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export type TileEnginePriority = "normal" | "raised";

export interface TileEngineMotion {
	from: TileEngineRect;
	priority: TileEnginePriority;
	nonce: number;
	kind?: never;
}

export namespace tileEngineMachine {
	export interface StageEntry {
		tileId: string;
		from: TileEngineRect;
		priority?: TileEnginePriority;
	}

	export type Event =
		| {
				type: "STAGE";
				entries: readonly StageEntry[];
		  }
		| {
				type: "SETTLED";
				tileId: string;
				nonce: number;
		  }
		| {
				type: "CLEAR";
		  };

	export interface Context {
		motions: Record<string, TileEngineMotion>;
		nextNonce: number;
	}
}

/**
 * Generic UI-only motion registry for stable tile actors.
 *
 * The tile engine never owns durable tile data. Parent code commits move/spawn
 * data through callbacks; this statechart only keeps the transient visual origin
 * that lets the final actor animate from a producer/stash/drop rect after it
 * already exists in its final slot.
 */
export const tileEngineMachine = setup({
	types: {
		context: {} as tileEngineMachine.Context,
		events: {} as tileEngineMachine.Event,
	},
}).createMachine({
	id: "tileEngine",
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
							motions[entry.tileId] = {
								from: entry.from,
								priority: entry.priority ?? "raised",
								nonce: nextNonce,
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
						const current = context.motions[event.tileId];
						if (!current || current.nonce !== event.nonce) return context;

						const { [event.tileId]: _settled, ...motions } = context.motions;

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
