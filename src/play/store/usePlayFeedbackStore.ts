import { create } from "zustand";
import { flashMs } from "~/play/types";

export namespace usePlayFeedbackStore {
	export interface State {
		invalidBoardCellKey: string | null;
		mergedBoardCellKey: string | null;
		invalidInventorySlot: number | null;
		actionErrorKey: number;
		flashBoardCell(key: string | null, tone: "error"): void;
		pulseMergeCell(key: string | null): void;
		flashInventorySlot(slotIndex: number | null, tone: "error"): void;
		showError(error: unknown): void;
	}
}

export const usePlayFeedbackStore = create<usePlayFeedbackStore.State>((set, get) => ({
	invalidBoardCellKey: null,
	mergedBoardCellKey: null,
	invalidInventorySlot: null,
	actionErrorKey: 0,
	flashBoardCell(key, tone) {
		if (!key || tone !== "error") return;

		set({
			invalidBoardCellKey: key,
		});
		window.setTimeout(() => {
			if (get().invalidBoardCellKey === key)
				set({
					invalidBoardCellKey: null,
				});
		}, flashMs);
	},
	pulseMergeCell(key) {
		if (!key) return;

		set({
			mergedBoardCellKey: null,
		});
		window.requestAnimationFrame(() => {
			set({
				mergedBoardCellKey: key,
			});
			window.setTimeout(() => {
				if (get().mergedBoardCellKey === key)
					set({
						mergedBoardCellKey: null,
					});
			}, 560);
		});
	},
	flashInventorySlot(slotIndex, tone) {
		if (slotIndex === null || slotIndex === undefined || tone !== "error") return;

		set({
			invalidInventorySlot: slotIndex,
		});
		window.setTimeout(() => {
			if (get().invalidInventorySlot === slotIndex)
				set({
					invalidInventorySlot: null,
				});
		}, flashMs);
	},
	showError(error) {
		set((state) => ({
			actionErrorKey: state.actionErrorKey + 1,
		}));

		if (import.meta.env.DEV) {
			console.debug("Game action rejected", error);
		}
	},
}));
