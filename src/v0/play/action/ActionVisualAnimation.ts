import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";

export const actionVisualSequenceDelayMs = 200;
export const actionVisualFadeDurationMs = 420;
export const actionVisualMoveDurationMs = 420;
export const actionVisualMergeDurationMs = 390;
export const actionVisualReplaceDurationMs = 420;

export namespace ActionVisualAnimation {
	export interface BaseProps {
		groupId: string;
		cause: ActionVisualAnimationSchema.Type["cause"];
		durationMs?: number;
	}

	export interface SequenceProps extends BaseProps {
		sequenceIndex: number;
		delayMs?: number;
	}
}

export const ActionVisualAnimation = {
	parallelMove: ({
		cause,
		durationMs = actionVisualMoveDurationMs,
		groupId,
	}: ActionVisualAnimation.BaseProps): ActionVisualAnimationSchema.Type => ({
		cause,
		durationMs,
		effect: "move",
		groupId,
		mode: "parallel",
	}),
	instantFadeIn: ({
		cause,
		durationMs = actionVisualFadeDurationMs,
		groupId,
	}: ActionVisualAnimation.BaseProps): ActionVisualAnimationSchema.Type => ({
		cause,
		durationMs,
		effect: "fade-in",
		groupId,
		mode: "instant",
	}),
	merge: ({
		cause,
		durationMs = actionVisualMergeDurationMs,
		groupId,
	}: ActionVisualAnimation.BaseProps): ActionVisualAnimationSchema.Type => ({
		cause,
		durationMs,
		effect: "merge",
		groupId,
		mode: "parallel",
	}),
	replace: ({
		cause,
		durationMs = actionVisualReplaceDurationMs,
		groupId,
	}: ActionVisualAnimation.BaseProps): ActionVisualAnimationSchema.Type => ({
		cause,
		durationMs,
		effect: "replace",
		groupId,
		mode: "parallel",
	}),
	sequenceFadeIn: ({
		cause,
		delayMs,
		durationMs = actionVisualFadeDurationMs,
		groupId,
		sequenceIndex,
	}: ActionVisualAnimation.SequenceProps): ActionVisualAnimationSchema.Type => ({
		cause,
		delayMs: delayMs ?? sequenceIndex * actionVisualSequenceDelayMs,
		durationMs,
		effect: "fade-in",
		groupId,
		mode: "sequence",
		sequenceIndex,
	}),
	state: ({
		cause,
		durationMs = actionVisualMoveDurationMs,
		groupId,
	}: ActionVisualAnimation.BaseProps): ActionVisualAnimationSchema.Type => ({
		cause,
		durationMs,
		effect: "state",
		groupId,
		mode: "instant",
	}),
} as const;
