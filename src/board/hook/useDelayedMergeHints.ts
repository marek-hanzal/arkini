import { useEffect, useState } from "react";
import type { DragData } from "~/play/types";

const defaultMergeHintDelayMs = 750;

export namespace useDelayedMergeHints {
	export interface Props {
		activeDrag?: DragData;
		delayMs?: number;
	}
}

export function useDelayedMergeHints({
	activeDrag,
	delayMs = defaultMergeHintDelayMs,
}: useDelayedMergeHints.Props) {
	const [visible, setVisible] = useState(false);
	const activeBoardItemId =
		activeDrag?.source.kind === "board" ? activeDrag.source.boardItemId : undefined;
	const activeItemId = activeDrag?.source.kind === "board" ? activeDrag.itemId : undefined;

	useEffect(() => {
		setVisible(false);
		if (!activeBoardItemId || !activeItemId) return;

		const timeout = window.setTimeout(() => {
			setVisible(true);
		}, delayMs);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [
		activeBoardItemId,
		activeItemId,
		delayMs,
	]);

	return visible;
}
