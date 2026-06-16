import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";

export const actionVisualSequenceDelayMs = 135;
export const actionVisualFadeDurationMs = 280;
export const actionVisualMoveDurationMs = 280;

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
