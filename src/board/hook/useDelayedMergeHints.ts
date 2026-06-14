import { useMachine } from "@xstate/react";
import { useEffect } from "react";
import { delayedMergeHintMachine } from "~/board/logic/delayedMergeHintMachine";
import type { GameDragData } from "~/play/types";

const defaultMergeHintDelayMs = 750;

export namespace useDelayedMergeHints {
	export interface Props {
		activeDrag?: GameDragData;
		delayMs?: number;
	}
}

export function useDelayedMergeHints({
	activeDrag,
	delayMs = defaultMergeHintDelayMs,
}: useDelayedMergeHints.Props) {
	const [hint, sendHint] = useMachine(delayedMergeHintMachine);
	const activeBoardItemId =
		activeDrag?.source.kind === "board" ? activeDrag.source.boardItemId : undefined;
	const activeItemId = activeDrag?.source.kind === "board" ? activeDrag.itemId : undefined;

	useEffect(() => {
		if (!activeBoardItemId || !activeItemId) {
			sendHint({
				type: "STOP",
			});
			return;
		}

		sendHint({
			type: "START",
			delayMs,
		});
	}, [
		activeBoardItemId,
		activeItemId,
		delayMs,
		sendHint,
	]);

	return hint.matches("visible");
}
