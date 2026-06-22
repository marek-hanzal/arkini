export const gameVisualSequenceDelayMs = 200;
export const gameVisualFadeDurationMs = 420;
export const gameVisualMergeDurationMs = 390;
export const gameVisualReplaceDurationMs = 420;

export type GameVisualMotionCause =
	| "activation"
	| "craft"
	| "inventory"
	| "merge"
	| "producer"
	| "stash";

export type GameVisualMotionEffect = "fade-in" | "merge" | "replace";

export interface GameVisualMotion {
	cause: GameVisualMotionCause;
	delayMs?: number;
	durationMs?: number;
	effect: GameVisualMotionEffect;
	groupId: string;
	sequenceIndex?: number;
}

export namespace GameVisualMotion {
	export interface BaseProps {
		cause: GameVisualMotionCause;
		durationMs?: number;
		groupId: string;
	}

	export interface SequenceProps extends BaseProps {
		delayMs?: number;
		sequenceIndex: number;
	}
}

export const GameVisualMotion = {
	merge: ({
		cause,
		durationMs = gameVisualMergeDurationMs,
		groupId,
	}: GameVisualMotion.BaseProps): GameVisualMotion => ({
		cause,
		durationMs,
		effect: "merge",
		groupId,
	}),
	replace: ({
		cause,
		durationMs = gameVisualReplaceDurationMs,
		groupId,
	}: GameVisualMotion.BaseProps): GameVisualMotion => ({
		cause,
		durationMs,
		effect: "replace",
		groupId,
	}),
	sequenceFadeIn: ({
		cause,
		delayMs,
		durationMs = gameVisualFadeDurationMs,
		groupId,
		sequenceIndex,
	}: GameVisualMotion.SequenceProps): GameVisualMotion => ({
		cause,
		delayMs: delayMs ?? sequenceIndex * gameVisualSequenceDelayMs,
		durationMs,
		effect: "fade-in",
		groupId,
		sequenceIndex,
	}),
} as const;
