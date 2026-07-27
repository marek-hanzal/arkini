import type { Effect } from "effect";

export interface PixiAnimationControl {
	readonly stopFx: Effect.Effect<void>;
}

export interface PixiAnimationSpring {
	readonly closeFx: Effect.Effect<void>;
	readonly setTargetFx: (value: number) => Effect.Effect<void>;
}

interface PixiSpringOptions {
	readonly damping: number;
	readonly mass: number;
	readonly restDelta: number;
	readonly restSpeed: number;
	readonly stiffness: number;
	readonly velocity?: number;
}

export type PixiAnimationCurve =
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

export interface PixiAnimationDriver {
	readonly createSpringFx: (props: {
		readonly initialValue: number;
		readonly onUpdate: (value: number) => void;
		readonly options: PixiSpringOptions;
	}) => Effect.Effect<PixiAnimationSpring>;
	readonly startTweenFx: (props: {
		readonly curve?: PixiAnimationCurve;
		readonly delayMs?: number;
		readonly durationMs: number;
		readonly from: number;
		readonly onComplete?: () => void;
		readonly onUpdate: (value: number) => void;
		readonly repeat?: number;
		readonly to: number;
	}) => Effect.Effect<PixiAnimationControl>;
	readonly closeFx: Effect.Effect<void>;
}
