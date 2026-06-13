import { create } from "zustand";
import { flashMs } from "~/play/types";

export namespace usePlayFeedbackStore {
	export interface State {
		invalidBoardCellKey?: string;
		mergedBoardCellKey?: string;
		invalidInventorySlot?: number;
		flashBoardCell(key: string | undefined, tone: "error"): void;
		pulseMergeCell(key: string | undefined): void;
		flashInventorySlot(slotIndex: number | undefined, tone: "error"): void;
		showError(error: unknown): void;
	}
}

export const usePlayFeedbackStore = create<usePlayFeedbackStore.State>((set, get) => ({
	flashBoardCell(key, tone) {
		if (!key || tone !== "error") return;

		set({
			invalidBoardCellKey: key,
		});
		window.setTimeout(() => {
			if (get().invalidBoardCellKey === key)
				set({
					invalidBoardCellKey: undefined,
				});
		}, flashMs);
	},
	pulseMergeCell(key) {
		if (!key) return;

		set({
			mergedBoardCellKey: undefined,
		});
		window.requestAnimationFrame(() => {
			set({
				mergedBoardCellKey: key,
			});
			window.setTimeout(() => {
				if (get().mergedBoardCellKey === key)
					set({
						mergedBoardCellKey: undefined,
					});
			}, 560);
		});
	},
	flashInventorySlot(slotIndex, tone) {
		if (slotIndex === undefined || tone !== "error") return;

		set({
			invalidInventorySlot: slotIndex,
		});
		window.setTimeout(() => {
			if (get().invalidInventorySlot === slotIndex)
				set({
					invalidInventorySlot: undefined,
				});
		}, flashMs);
	},
	showError(error) {
		if (import.meta.env.DEV) {
			console.debug("Game action rejected", error);
		}
	},
}));
