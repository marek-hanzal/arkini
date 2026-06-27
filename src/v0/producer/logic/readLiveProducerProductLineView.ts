import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readGameTimeProgress } from "~/v0/game/time/GameTime";

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
	if (line.startAtMs === undefined || line.readyAtMs === undefined) return line;

	const progress = readGameTimeProgress({
		nowMs: line.pausedAtMs ?? nowMs,
		readyAtMs: line.readyAtMs,
		startAtMs: line.startAtMs,
	});

	return {
		...line,
		progress,
	};
};
