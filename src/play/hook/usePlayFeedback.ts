import { useMachine } from "@xstate/react";
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

export function usePlayFeedback(): usePlayFeedback.State {
	const [feedback, send] = useMachine(playFeedbackMachine);

	return {
		invalidBoardCellKey: feedback.context.invalidBoardCellKey,
		mergedBoardCellKey: feedback.context.mergedBoardCellKey,
		imprintedBoardCellKey: feedback.context.imprintedBoardCellKey,
		invalidInventorySlot: feedback.context.invalidInventorySlot,
		flashBoardCell(key, tone) {
			if (!key || tone !== "error") return;
			send({
				type: "FLASH_BOARD_CELL",
				key,
			});
		},
		pulseMergeCell(key) {
			if (!key) return;
			send({
				type: "PULSE_MERGE_CELL",
				key,
			});
		},
		pulseImprintCell(key) {
			if (!key) return;
			send({
				type: "PULSE_IMPRINT_CELL",
				key,
			});
		},
		flashInventorySlot(slotIndex, tone) {
			if (slotIndex === undefined || tone !== "error") return;
			send({
				type: "FLASH_INVENTORY_SLOT",
				slotIndex,
			});
		},
		showError(error) {
			if (import.meta.env.DEV) {
				console.debug("Game action rejected", error);
			}
		},
	};
}
