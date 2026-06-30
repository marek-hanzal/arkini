import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";

const readBoardProgressDisplay = (line: ProducerProductLineView) => {
	const progress = line.progress ?? 0;
	return line.lineKind === "effect" ? 1 - progress : progress;
};

const compareRunningLines = (left: ProducerProductLineView, right: ProducerProductLineView) => {
	const leftKindPriority = left.lineKind === "effect" ? 0 : 1;
	const rightKindPriority = right.lineKind === "effect" ? 0 : 1;

	return (
		leftKindPriority - rightKindPriority ||
		(left.startAtMs ?? 0) - (right.startAtMs ?? 0) ||
		(left.readyAtMs ?? 0) - (right.readyAtMs ?? 0) ||
		left.productId.localeCompare(right.productId)
	);
};

export namespace readProducerBoardProgress {
	export interface Props {
		activation?: ActivationView;
		nowMs: number;
	}
}

export function readProducerBoardProgress({ activation, nowMs }: readProducerBoardProgress.Props) {
	if (!activation?.productLines?.length) return undefined;

	const runningLine = activation.productLines
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

	const liveLine = readLiveProducerProductLineView({
		line: runningLine,
		nowMs,
	});

	return {
		progress: readBoardProgressDisplay(liveLine),
	};
}
