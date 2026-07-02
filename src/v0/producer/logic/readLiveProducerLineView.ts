import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/v0/game/time/GameTime";

export namespace readLiveProducerLineView {
	export interface Props {
		line: ProducerLineView;
		nowMs: number;
	}
}

export const readLiveProducerLineView = ({
	line,
	nowMs,
}: readLiveProducerLineView.Props): ProducerLineView => {
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
