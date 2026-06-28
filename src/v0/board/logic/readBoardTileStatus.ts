import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";

export namespace readBoardTileStatus {
	export interface Props {
		boardItem?: BoardViewItem | null;
		nowMs: number;
	}

	export interface Result {
		ready: boolean;
	}
}

export const readBoardTileStatus = ({
	boardItem,
	nowMs,
}: readBoardTileStatus.Props): readBoardTileStatus.Result => {
	const activationReady = isProducerReady(boardItem?.activation, nowMs);
	const craftReady = Boolean(boardItem?.craft?.complete);
	const hasReadyState = Boolean(boardItem?.activation || boardItem?.craft);

	return {
		ready: !hasReadyState || activationReady || craftReady,
	};
};
