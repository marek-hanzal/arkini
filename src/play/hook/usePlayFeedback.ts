import { useMachine } from "@xstate/react";
import { useCallback, useMemo } from "react";
import { playFeedbackMachine } from "~/play/logic/playFeedbackMachine";

export namespace usePlayFeedback {
	export interface State {
		invalidBoardCellKey?: string;
		mergedBoardCellKey?: string;
		imprintedBoardCellKey?: string;
		invalidInventorySlot?: number;
		flashBoardCell(key: string | undefined, tone: "error"): void;
		pulseMergeCell(key: string | undefined): void;
		pulseImprintCell(key: string | undefined): void;
		flashInventorySlot(slotIndex: number | undefined, tone: "error"): void;
		showError(error: unknown): void;
	}
}

/**
 * GPT:FIX
 *
 * I understand overall idea of this hook, but at the end it's more mess which does not make a lof of sense.
 *
 * What about idea to have core (global) EventBus (even wrap native one from browser or steal EventBus impl. from zbav-se.me which is typed),
 * so we can send typed events instead of messing up with such a crap?
 */
export function usePlayFeedback(): usePlayFeedback.State {
	const [feedback, send] = useMachine(playFeedbackMachine);
	const flashBoardCell = useCallback(
		(key: string | undefined, tone: "error") => {
			if (!key || tone !== "error") return;
			send({
				type: "FLASH_BOARD_CELL",
				key,
			});
		},
		[
			send,
		],
	);
	const pulseMergeCell = useCallback(
		(key: string | undefined) => {
			if (!key) return;
			send({
				type: "PULSE_MERGE_CELL",
				key,
			});
		},
		[
			send,
		],
	);
	const pulseImprintCell = useCallback(
		(key: string | undefined) => {
			if (!key) return;
			send({
				type: "PULSE_IMPRINT_CELL",
				key,
			});
		},
		[
			send,
		],
	);
	const flashInventorySlot = useCallback(
		(slotIndex: number | undefined, tone: "error") => {
			if (slotIndex === undefined || tone !== "error") return;
			send({
				type: "FLASH_INVENTORY_SLOT",
				slotIndex,
			});
		},
		[
			send,
		],
	);
	const showError = useCallback((error: unknown) => {
		if (import.meta.env.DEV) {
			console.debug("Game action rejected", error);
		}
	}, []);

	return useMemo(
		() => ({
			invalidBoardCellKey: feedback.context.invalidBoardCellKey,
			mergedBoardCellKey: feedback.context.mergedBoardCellKey,
			imprintedBoardCellKey: feedback.context.imprintedBoardCellKey,
			invalidInventorySlot: feedback.context.invalidInventorySlot,
			flashBoardCell,
			pulseMergeCell,
			pulseImprintCell,
			flashInventorySlot,
			showError,
		}),
		[
			feedback.context.imprintedBoardCellKey,
			feedback.context.invalidBoardCellKey,
			feedback.context.invalidInventorySlot,
			feedback.context.mergedBoardCellKey,
			flashBoardCell,
			flashInventorySlot,
			pulseImprintCell,
			pulseMergeCell,
			showError,
		],
	);
}
