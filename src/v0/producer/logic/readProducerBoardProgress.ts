import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";

export namespace readProducerBoardProgress {
	export interface Props {
		activation?: ActivationView;
		nowMs: number;
	}
}

export function readProducerBoardProgress({ activation, nowMs }: readProducerBoardProgress.Props) {
	if (activation?.kind !== "producer") return undefined;

	const runningLine = activation.productLines
		?.filter(
			(line) =>
				line.startAtMs !== undefined &&
				line.readyAtMs !== undefined &&
				line.startAtMs <= nowMs &&
				(line.pausedAtMs !== undefined || line.readyAtMs > nowMs),
		)
		.sort(
			(left, right) =>
				(left.startAtMs ?? 0) - (right.startAtMs ?? 0) ||
				(left.readyAtMs ?? 0) - (right.readyAtMs ?? 0) ||
				left.productId.localeCompare(right.productId),
		)[0];

	if (!runningLine) return undefined;

	return {
		progress: readLiveProducerProductLineView({
			line: runningLine,
			nowMs,
		}).progress,
	};
}
