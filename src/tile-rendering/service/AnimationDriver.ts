import type { Effect } from "effect";

export interface AnimationControl {
	readonly stopFx: Effect.Effect<void, never, never>;
}

export interface AnimationSpring {
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly setTargetFx: (value: number) => Effect.Effect<void, never, never>;
}

interface SpringOptions {
	readonly damping: number;
	readonly mass: number;
	readonly restDelta: number;
	readonly restSpeed: number;
	readonly stiffness: number;
	readonly velocity?: number;
}

export type AnimationCurve =
	| {
			readonly kind: "ease-in-out";
	  }
	| {
			readonly kind: "linear";
	  }
	| {
			readonly bounce: number;
			readonly kind: "spring";
	  };

export interface AnimationDriver {
	readonly createSpringFx: (props: {
		readonly initialValue: number;
		readonly onUpdate: (value: number) => void;
		readonly options: SpringOptions;
	}) => Effect.Effect<AnimationSpring, never, never>;
	readonly startTweenFx: (props: {
		readonly curve?: AnimationCurve;
		readonly delayMs?: number;
		readonly durationMs: number;
		readonly from: number;
		readonly onComplete?: () => void;
		readonly onUpdate: (value: number) => void;
		readonly repeat?: number;
		readonly to: number;
	}) => Effect.Effect<AnimationControl, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
