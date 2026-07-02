import type { LineView } from "~/board/view/LineViewSchema";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/time/GameTime";

export namespace readLiveLineView {
	export interface Props {
		line: LineView;
		nowMs: number;
	}
}

export const readLiveLineView = ({ line, nowMs }: readLiveLineView.Props): LineView => {
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
