import type { ActivationView } from "~/board/view/ActivationViewSchema";
import type { LineView } from "~/board/view/LineViewSchema";
import { readLiveLineView } from "~/producer/logic/readLiveLineView";

const readBoardProgressDisplay = (line: LineView) => {
	const progress = line.progress ?? 0;
	return line.kind === "effect" ? 1 - progress : progress;
};

const compareRunningLines = (left: LineView, right: LineView) => {
	const leftKindPriority = left.kind === "effect" ? 0 : 1;
	const rightKindPriority = right.kind === "effect" ? 0 : 1;

	return (
		leftKindPriority - rightKindPriority ||
		(left.startAtMs ?? 0) - (right.startAtMs ?? 0) ||
		(left.readyAtMs ?? 0) - (right.readyAtMs ?? 0) ||
		left.lineId.localeCompare(right.lineId)
	);
};

export namespace readProducerBoardProgress {
	export interface Props {
		activation?: ActivationView;
		nowMs: number;
	}
}

export function readProducerBoardProgress({ activation, nowMs }: readProducerBoardProgress.Props) {
	if (!activation?.lines?.length) return undefined;

	const runningLine = activation.lines
		?.filter(
			(line) =>
				line.startAtMs !== undefined &&
				line.readyAtMs !== undefined &&
				!line.deliveryBlocked &&
				line.startAtMs <= nowMs &&
				(line.pausedAtMs !== undefined || line.readyAtMs > nowMs),
		)
		.sort(compareRunningLines)[0];

	if (!runningLine) return undefined;

	const liveLine = readLiveLineView({
		line: runningLine,
		nowMs,
	});

	return {
		progress: readBoardProgressDisplay(liveLine),
	};
}
