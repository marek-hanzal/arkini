import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/v0/game/time/GameTime";

export namespace readLiveProducerProductLineView {
	export interface Props {
		line: ProducerProductLineView;
		nowMs: number;
	}
}

export const readLiveProducerProductLineView = ({
	line,
	nowMs,
}: readLiveProducerProductLineView.Props): ProducerProductLineView => {
	if (line.deliveryBlocked || line.startAtMs === undefined || line.readyAtMs === undefined)
		return line;

	const clockNowMs = line.pausedAtMs ?? nowMs;
	const progress = readGameTimeProgress({
		nowMs: clockNowMs,
		readyAtMs: line.readyAtMs,
		startAtMs: line.startAtMs,
	});
	const remainingMs = readGameTimeRemainingMs({
		nowMs: clockNowMs,
		readyAtMs: line.readyAtMs,
	});

	return {
		...line,
		progress,
		remainingMs,
	};
};
