import type { LineView } from "~/board/view/LineViewSchema";
import {
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
} from "~/time/GameTime";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";

export type RuntimeLineTimingViewState = Pick<
	LineView,
	| "deliveryBlocked"
	| "durationMs"
	| "pausedAtMs"
	| "progress"
	| "readyAtMs"
	| "remainingMs"
	| "startAtMs"
>;

export namespace readRuntimeLineTimingViewState {
	export interface Props {
		activeJobFacts?: WorldProducerJobFacts;
		effectiveLineDurationMs: number;
		nowMs: number;
	}
}

export const readRuntimeLineTimingViewState = ({
	activeJobFacts,
	effectiveLineDurationMs,
	nowMs,
}: readRuntimeLineTimingViewState.Props): RuntimeLineTimingViewState => {
	const activeJob = activeJobFacts?.job;
	if (!activeJob) {
		return {
			durationMs: effectiveLineDurationMs,
		};
	}

	const deliveryBlocked = activeJobFacts.status === "delivery_blocked";
	const lineClockNowMs = activeJob.pausedAtMs ?? nowMs;

	return {
		deliveryBlocked,
		durationMs: readGameTimeDurationMs({
			readyAtMs: activeJob.readyAtMs,
			startAtMs: activeJob.startAtMs,
		}),
		pausedAtMs: activeJob.pausedAtMs,
		progress: deliveryBlocked
			? undefined
			: readGameTimeProgress({
					nowMs: lineClockNowMs,
					readyAtMs: activeJob.readyAtMs,
					startAtMs: activeJob.startAtMs,
				}),
		readyAtMs: activeJob.readyAtMs,
		remainingMs: deliveryBlocked
			? undefined
			: readGameTimeRemainingMs({
					nowMs: lineClockNowMs,
					readyAtMs: activeJob.readyAtMs,
				}),
		startAtMs: activeJob.startAtMs,
	};
};
