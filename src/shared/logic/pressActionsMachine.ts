import { assign, setup } from "xstate";
import { pressTransitions } from "./pressTransitions";

const doublePressMs = 320;
const doublePressDistancePx = 24;
const longPressMs = 520;

export namespace pressActionsMachine {
	export interface LastPress {
		time: number;
		x: number;
		y: number;
		pointerType: string;
	}

	export interface Context {
		lastPress?: LastPress;
		hasSingle: boolean;
		hasDouble: boolean;
		hasLong: boolean;
		delaySingleWhenDouble: boolean;
	}

	export type Event =
		| {
				type: "CONFIG_CHANGED";
				hasSingle: boolean;
				hasDouble: boolean;
				hasLong: boolean;
				delaySingleWhenDouble: boolean;
		  }
		| {
				type: "PRESS_STARTED";
		  }
		| {
				type: "PRESS_ENDED";
		  }
		| {
				type: "PRESS";
				time: number;
				x: number;
				y: number;
				pointerType: string;
		  };
}

export const pressActionsMachine = setup({
	types: {
		context: {} as pressActionsMachine.Context,
		events: {} as pressActionsMachine.Event,
	},
	actions: {
		setConfig: assign(({ event }) => {
			if (event.type !== "CONFIG_CHANGED") return {};
			return {
				hasSingle: event.hasSingle,
				hasDouble: event.hasDouble,
				hasLong: event.hasLong,
				delaySingleWhenDouble: event.delaySingleWhenDouble,
			};
		}),
		setLastPress: assign(({ event }) => {
			if (event.type !== "PRESS") return {};
			return {
				lastPress: {
					time: event.time,
					x: event.x,
					y: event.y,
					pointerType: event.pointerType,
				},
			};
		}),
		clearLastPress: assign({
			lastPress: undefined,
		}),
		callSingle: () => undefined,
		callDouble: () => undefined,
		callLong: () => undefined,
	},
	guards: {
		hasLong: ({ context }) => context.hasLong,
		hasSingle: ({ context }) => context.hasSingle,
		hasDouble: ({ context }) => context.hasDouble,
		isNearbyDouble: ({ context, event }) => {
			if (event.type !== "PRESS" || !context.hasDouble || !context.lastPress) return false;
			return (
				context.lastPress.pointerType === event.pointerType &&
				event.time - context.lastPress.time <= doublePressMs &&
				Math.abs(event.x - context.lastPress.x) <= doublePressDistancePx &&
				Math.abs(event.y - context.lastPress.y) <= doublePressDistancePx
			);
		},
		shouldDelaySingle: ({ context }) =>
			context.hasSingle && context.hasDouble && context.delaySingleWhenDouble,
		shouldCallSingleAndRemember: ({ context }) =>
			context.hasSingle && context.hasDouble && !context.delaySingleWhenDouble,
		shouldRememberOnly: ({ context }) => !context.hasSingle && context.hasDouble,
	},
}).createMachine({
	id: "pressActions",
	initial: "idle",
	context: {
		hasSingle: false,
		hasDouble: false,
		hasLong: false,
		delaySingleWhenDouble: false,
	},
	on: {
		CONFIG_CHANGED: {
			actions: "setConfig",
		},
	},
	states: {
		idle: {
			on: {
				PRESS_STARTED: "pressing",
				PRESS: pressTransitions(),
			},
		},
		pressing: {
			after: {
				[longPressMs]: {
					guard: "hasLong",
					target: "longPressed",
					actions: [
						"clearLastPress",
						"callLong",
					],
				},
			},
			on: {
				PRESS_ENDED: "idle",
				PRESS: pressTransitions(),
			},
		},
		singlePending: {
			after: {
				[doublePressMs]: {
					target: "idle",
					actions: [
						"clearLastPress",
						"callSingle",
					],
				},
			},
			on: {
				PRESS_STARTED: "pressing",
				PRESS: pressTransitions(),
			},
		},
		longPressed: {
			on: {
				PRESS: "idle",
				PRESS_STARTED: "pressing",
				PRESS_ENDED: "idle",
			},
		},
	},
});
