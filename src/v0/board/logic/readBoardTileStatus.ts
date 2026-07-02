import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";

export namespace readBoardTileStatus {
	export interface Props {
		boardItem?: BoardViewItem | null;
		nowMs: number;
	}

	export interface Result {
		ready: boolean;
		dimmed: boolean;
	}
}

export const readBoardTileStatus = ({
	boardItem,
	nowMs,
}: readBoardTileStatus.Props): readBoardTileStatus.Result => {
	const activation = boardItem?.activation;
	const activationReady = isProducerReady(activation, nowMs);
	const craftReady = Boolean(boardItem?.craft?.complete);
	const hasReadyState = Boolean(activation || boardItem?.craft);
	const ready = !hasReadyState || activationReady || craftReady;
	const noExplicitDefaultProducer =
		activation?.kind === "producer" && !activation.lines?.some((line) => line.isDefault);

	return {
		ready,
		dimmed: hasReadyState && !ready && !noExplicitDefaultProducer,
	};
};
