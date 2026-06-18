import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";

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
	if (line.startedAtMs === undefined || line.readyAtMs === undefined) return line;

	const progress = Math.max(
		0,
		Math.min(1, (nowMs - line.startedAtMs) / Math.max(1, line.readyAtMs - line.startedAtMs)),
	);

	return {
		...line,
		progress,
	};
};
